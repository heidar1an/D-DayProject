<?php

namespace App\Services\Notifications\Channels;

use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\NotificationDelivery as Delivery;

/**
 * کانال درون‌برنامه‌ای — **اولین مسیر واقعی** فاز ۱۹ (§21).
 *
 * «تحویل» در این کانال یعنی ردیف اعلان برای کاربر قابل خواندن است؛ کار بیرونی
 * ندارد. به همین دلیل بلافاصله `delivered` می‌شود و صف لازم نیست.
 */
final class InAppChannelProvider implements NotificationChannelProvider
{
    public function channel(): string
    {
        return 'in_app';
    }

    public function enabled(): bool
    {
        return (bool) config('notifications.channels.in_app.enabled', true);
    }

    public function deliver(Notification $notification, NotificationDelivery $delivery): string
    {
        return Delivery::STATUS_DELIVERED;
    }
}
