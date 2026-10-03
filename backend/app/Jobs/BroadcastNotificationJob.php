<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\User;
use App\Services\Notifications\NotificationService;
use Illuminate\Support\Facades\Log;

/**
 * ارسال گروهی اعلان از پنل — فاز ۱۹/۲۰ (§88/§103/§108).
 *
 * چرا chunked و cursor-based: «bulk بدون limit ممنوع» (§103). هر Job یک batch
 * محدود را پردازش می‌کند و batch بعدی را با **keyset cursor** (`id > afterId`)
 * صف می‌کند — نه offset، که با رشد جدول رکورد جا می‌گذارد.
 *
 * Duplicate-safe: `dedup_key = {broadcastKey}:{userId}` با UNIQUE جزئی قفل است،
 * پس اجرای دوبارهٔ Job اعلان تکراری نمی‌سازد (§27).
 *
 * payload این Job عنوان/متن **plain text** است؛ هیچ شناسهٔ رازی در آن نیست و
 * متن قبلاً در `NotificationPayloadSanitizer` پاک شده است.
 */
final class BroadcastNotificationJob extends TapeshJob
{
    public function __construct(
        private readonly string $broadcastKey,
        private readonly string $title,
        private readonly string $body,
        private readonly ?string $afterId = null,
        private readonly int $processed = 0,
    ) {
        parent::__construct();
    }

    protected function policyKey(): string
    {
        return 'notifications';
    }

    protected function queueName(): string
    {
        return (string) config('notifications.delivery.queue', 'notifications');
    }

    public function handle(NotificationService $service): void
    {
        $chunk = max(1, (int) config('notifications.broadcast.chunk'));
        $maxRecipients = max(1, (int) config('notifications.broadcast.max_recipients'));

        $query = User::query()->orderBy('id')->limit($chunk);

        if ($this->afterId !== null && $this->afterId !== '') {
            $query->where('id', '>', $this->afterId);
        }

        /** @var list<string> $userIds */
        $userIds = $query->pluck('id')->map(static fn ($id): string => (string) $id)->all();

        $created = 0;

        foreach ($userIds as $userId) {
            $notification = $service->create(
                $userId,
                Notification::TYPE_SYSTEM,
                ['title' => $this->title, 'body' => $this->body],
                $this->broadcastKey.':'.$userId,
            );

            if ($notification instanceof Notification) {
                $created++;
            }
        }

        Log::info('notification.broadcast_chunk', [
            'broadcast_key' => $this->broadcastKey,
            'recipients' => count($userIds),
            'created' => $created,
        ]);

        $lastId = $userIds === [] ? null : (string) end($userIds);
        $processed = $this->processed + count($userIds);

        /* batch بعدی فقط اگر همین batch پر بود و سقف کل رعایت شده باشد. */
        if ($lastId !== null && count($userIds) === $chunk && $processed < $maxRecipients) {
            self::dispatch($this->broadcastKey, $this->title, $this->body, $lastId, $processed);
        }
    }
}
