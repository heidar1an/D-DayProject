<?php

namespace App\Services\Notifications;

use App\Jobs\DeliverNotificationJob;
use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * NotificationService — فاز ۱۹ (§22).
 *
 * تنها مسیر ساخت/خواندن/تحویل اعلان. Controller هیچ منطقی ندارد؛ مالکیت فقط
 * از سشن می‌آید و `read_at` سرور-محور است (§26).
 *
 * Idempotent: `dedup_key` با UNIQUE جزئی قفل شده، پس رخداد تکراری اعلان
 * تکراری نمی‌سازد (§27).
 */
final class NotificationService
{
    public function __construct(
        private readonly NotificationTypeRegistry $types,
        private readonly NotificationPayloadSanitizer $sanitizer,
        private readonly ChannelRegistry $channels,
    ) {}

    /**
     * ساخت اعلان + ردیف تحویل هر کانال مؤثر.
     *
     * @param  array<string, mixed>  $payload
     * @return Notification|null null یعنی dedup_key تکراری بود (اعلان تازه ساخته نشد)
     */
    public function create(string $userId, string $type, array $payload, ?string $dedupKey = null): ?Notification
    {
        $this->types->definition($type);

        $clean = $this->sanitizer->sanitize($type, $payload);

        $dedupKey = $dedupKey !== null && $dedupKey !== ''
            ? mb_substr($dedupKey, 0, (int) config('notifications.limits.dedup_key_max'))
            : null;

        /*
         * ⚠️ استثنا **بیرون** از `DB::transaction` گرفته می‌شود، نه داخل callback.
         *
         * اگر داخل callback بگیریم، `DB::transaction` کار را موفق می‌بیند و rollback
         * نمی‌کند ⇒ روی PostgreSQL تراکنش در وضعیت aborted می‌ماند و **هر دستور
         * بعدی** با `25P02` می‌شکند (روی SQLite هیچ اثری ندارد و باگ دیده نمی‌شود).
         * با گرفتن بیرونی، لاراول تا savepoint برمی‌گردد و وضعیت پاک می‌شود.
         */
        try {
            $notification = DB::transaction(function () use ($userId, $type, $clean, $dedupKey): Notification {
                $row = new Notification;
                $row->forceFill([
                    'user_id' => $userId,
                    'type' => $type,
                    'dedup_key' => $dedupKey,
                    'payload' => $clean,
                ])->save();

                return $row;
            });
        } catch (UniqueConstraintViolationException) {
            return null; /* همان رخداد قبلاً اعلان ساخته — دوباره ساخته نمی‌شود. */
        }

        $this->ensureDeliveries($notification);

        return $notification->refresh();
    }

    /** @return LengthAwarePaginator<int, Notification> */
    public function listForUser(User $user, int $perPage, ?string $type = null): LengthAwarePaginator
    {
        $query = Notification::query()->forUser((string) $user->getKey());

        if ($type !== null && $type !== '') {
            $this->types->definition($type);
            $query->where('type', $type);
        }

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function unreadCount(User $user): int
    {
        return Notification::query()->forUser((string) $user->getKey())->unread()->count();
    }

    /**
     * خواندن یک اعلان. مالکیت شرط است: اعلان کاربر دیگر ⇒ ۴۰۴ (نه ۴۰۳) تا
     * وجود شناسه افشا نشود (§25).
     */
    public function markRead(User $user, string $notificationId): Notification
    {
        $notification = Notification::query()
            ->forUser((string) $user->getKey())
            ->whereKey($notificationId)
            ->first();

        if (! $notification instanceof Notification) {
            abort(404);
        }

        if (! $notification->isRead()) {
            $notification->forceFill(['read_at' => now()])->save();
        }

        return $notification;
    }

    /** خواندن همه — فقط اعلان‌های خودِ کاربر. */
    public function markAllRead(User $user): int
    {
        return Notification::query()
            ->forUser((string) $user->getKey())
            ->unread()
            ->update(['read_at' => now(), 'updated_at' => now()]);
    }

    /**
     * تحویل روی یک کانال — فقط از Job صدا زده می‌شود.
     *
     * Duplicate-safe: تحویل `delivered`/`skipped` دوباره اجرا نمی‌شود.
     */
    public function deliver(Notification $notification, string $channel): string
    {
        $delivery = $this->deliveryFor($notification, $channel);

        if ($delivery === null) {
            return NotificationDelivery::STATUS_SKIPPED;
        }

        if (in_array($delivery->status, [NotificationDelivery::STATUS_DELIVERED, NotificationDelivery::STATUS_SKIPPED], true)) {
            return (string) $delivery->status;
        }

        $provider = $this->channels->provider($channel);

        if (! $provider->enabled()) {
            $this->updateDelivery($delivery, NotificationDelivery::STATUS_SKIPPED, null, false);

            return NotificationDelivery::STATUS_SKIPPED;
        }

        $status = $provider->deliver($notification, $delivery);

        $this->updateDelivery($delivery, $status, null, true);

        return $status;
    }

    /** ثبت شکست تحویل (از `failed()` جاب) — کد خطای امن، بدون پیام خام. */
    public function markDeliveryFailed(NotificationDelivery $delivery, string $errorCode): void
    {
        $this->updateDelivery($delivery, NotificationDelivery::STATUS_FAILED, $errorCode, true);
    }

    /** Retry دستی از پنل — فقط برای تحویل شکست‌خورده. */
    public function retryDelivery(NotificationDelivery $delivery): NotificationDelivery
    {
        if ($delivery->status === NotificationDelivery::STATUS_DELIVERED) {
            return $delivery;
        }

        $this->updateDelivery($delivery, NotificationDelivery::STATUS_PENDING, null, false);

        DeliverNotificationJob::dispatch((string) $delivery->notification_id, (string) $delivery->channel);

        return $delivery->refresh();
    }

    /**
     * ساخت ردیف تحویل هر کانال مؤثر. `in_app` بلافاصله تحویل‌شده است (نمایش
     * همان ردیف اعلان)؛ بقیه صف می‌شوند (§21).
     */
    private function ensureDeliveries(Notification $notification): void
    {
        $declared = $this->types->channels((string) $notification->type);
        $effective = $this->channels->effectiveChannels($declared);

        foreach ($effective as $channel) {
            $delivery = $this->deliveryFor($notification, $channel, create: true);

            if (! $delivery instanceof NotificationDelivery) {
                continue;
            }

            if ($channel === 'in_app') {
                $this->updateDelivery($delivery, NotificationDelivery::STATUS_DELIVERED, null, false);

                continue;
            }

            if ($delivery->status === NotificationDelivery::STATUS_PENDING) {
                DeliverNotificationJob::dispatch((string) $notification->getKey(), $channel)->afterCommit();
            }
        }
    }

    private function deliveryFor(Notification $notification, string $channel, bool $create = false): ?NotificationDelivery
    {
        $query = NotificationDelivery::query()
            ->where('notification_id', $notification->getKey())
            ->where('channel', $channel);

        $existing = $query->first();

        if ($existing instanceof NotificationDelivery || ! $create) {
            /** @var NotificationDelivery|null $existing */
            return $existing;
        }

        try {
            $delivery = new NotificationDelivery;
            $delivery->forceFill([
                'notification_id' => $notification->getKey(),
                'channel' => $channel,
                'status' => NotificationDelivery::STATUS_PENDING,
                'attempts' => 0,
            ])->save();

            return $delivery;
        } catch (UniqueConstraintViolationException) {
            /** @var NotificationDelivery|null $row */
            $row = $query->first();

            return $row;
        }
    }

    private function updateDelivery(NotificationDelivery $delivery, string $status, ?string $errorCode, bool $countAttempt): void
    {
        $attributes = [
            'status' => $status,
            'last_error_code' => $errorCode,
            'updated_at' => now(),
        ];

        if ($countAttempt) {
            $attributes['attempts'] = (int) $delivery->attempts + 1;
        }

        NotificationDelivery::query()->whereKey($delivery->getKey())->update($attributes);

        $delivery->forceFill($attributes);
    }
}
