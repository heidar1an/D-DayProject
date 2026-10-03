<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Services\Notifications\NotificationService;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * تحویل اعلان روی یک کانال — فاز ۱۹.
 *
 * فقط `notificationId` و `channel` حمل می‌شود (§8). Duplicate-safe: تحویل
 * `delivered`/`skipped` دوباره اجرا نمی‌شود و ردیف تحویل با
 * `UNIQUE(notification_id, channel)` قفل است (§20).
 */
final class DeliverNotificationJob extends TapeshJob
{
    public function __construct(
        private readonly string $notificationId,
        private readonly string $channel,
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
        $notification = Notification::query()->find($this->notificationId);

        if (! $notification instanceof Notification) {
            return; /* اعلان حذف شده — تحویل بی‌معناست، نه خطا. */
        }

        $startedAt = microtime(true);
        $status = $service->deliver($notification, $this->channel);

        Log::info('notification.delivery', [
            'notification_id' => $this->notificationId,
            'channel' => $this->channel,
            'status' => $status,
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);

        if ($status === NotificationDelivery::STATUS_FAILED) {
            /* خطای موقت ⇒ retry تا سقف `tries`؛ سپس dead-letter (§9). */
            throw new RuntimeException('Notification delivery failed on channel: '.$this->channel);
        }
    }

    public function failed(Throwable $error): void
    {
        parent::failed($error);

        $delivery = NotificationDelivery::query()
            ->where('notification_id', $this->notificationId)
            ->where('channel', $this->channel)
            ->first();

        if ($delivery instanceof NotificationDelivery) {
            app(NotificationService::class)->markDeliveryFailed($delivery, $error::class);
        }
    }
}
