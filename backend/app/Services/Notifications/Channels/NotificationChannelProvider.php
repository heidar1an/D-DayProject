<?php

namespace App\Services\Notifications\Channels;

use App\Models\Notification;
use App\Models\NotificationDelivery;

/**
 * قرارداد کانال تحویل — فاز ۱۹ (§29).
 *
 *   Notification → Channel Adapter → Provider
 *
 * Provider واقعی (Email/SMS/Push) **بدون Configuration/Consent فعال نمی‌شود**؛
 * تا آن زمان فقط `NullChannelProvider` وجود دارد که تحویل را `skipped`
 * علامت می‌زند تا هرگز «تحویل موفق» دروغین ثبت نشود.
 */
interface NotificationChannelProvider
{
    /** کلید کانال: in_app | email | sms | push */
    public function channel(): string;

    /** آیا Provider واقعی و پیکربندی‌شده است؟ */
    public function enabled(): bool;

    /**
     * تحویل و برگرداندن وضعیت نهایی (`delivered` یا `skipped`).
     * خطای موقت باید پرتاب شود تا Job retry کند.
     */
    public function deliver(Notification $notification, NotificationDelivery $delivery): string;
}
