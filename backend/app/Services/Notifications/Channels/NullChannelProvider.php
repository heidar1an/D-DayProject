<?php

namespace App\Services\Notifications\Channels;

use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\NotificationDelivery as Delivery;

/**
 * Provider غایب — برای کانال‌هایی که Provider/Consent/Quota واقعی ندارند
 * (email/sms/push در فاز ۱۹) (§16/§29).
 *
 * خروجی `skipped` است، نه `delivered`: ثبت تحویل موفق بدون Provider واقعی
 * یعنی دادهٔ کاذب در projection.
 */
final class NullChannelProvider implements NotificationChannelProvider
{
    public function __construct(private readonly string $channel) {}

    public function channel(): string
    {
        return $this->channel;
    }

    public function enabled(): bool
    {
        return (bool) config('notifications.channels.'.$this->channel.'.enabled', false);
    }

    public function deliver(Notification $notification, NotificationDelivery $delivery): string
    {
        return Delivery::STATUS_SKIPPED;
    }
}
