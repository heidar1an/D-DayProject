<?php

namespace App\Services\Commerce\Gateway;

use App\Exceptions\ApiErrorException;

/**
 * حل آداپتور درگاه از روی نام — فاز ۱۸.
 *
 * تنها جایی که «کدام درگاه» تصمیم گرفته می‌شود. سرویس‌های دامنه فقط
 * `PaymentGateway` را می‌شناسند، پس افزودن درگاه دوم هیچ تغییر منطقی نمی‌خواهد.
 *
 * ⚠️ درگاه واقعی عمداً پیاده‌سازی نشده است: طبق Scope Lock، تا وقتی قیمت واقعی
 * و merchant واقعی تأیید نشده، فعال‌کردن پرداخت واقعی ممنوع است. کلید
 * `commerce.gateway.zarinpal` فقط «محل اتصال» را مستند می‌کند و درخواست به آن
 * صریحاً 503 می‌گیرد — نه اینکه بی‌صدا به sandbox برگردد.
 */
final class GatewayManager
{
    /** آیا نام داده‌شده یک provider شناخته‌شده است؟ (برای مسیر webhook) */
    public function knows(string $provider): bool
    {
        return $provider === SandboxGateway::NAME || $provider === 'zarinpal';
    }

    public function driver(?string $name = null): PaymentGateway
    {
        $name ??= (string) config('commerce.gateway.driver');

        return match ($name) {
            SandboxGateway::NAME => new SandboxGateway,
            'zarinpal' => throw ApiErrorException::notConfigured('Payment gateway (zarinpal)'),
            default => throw ApiErrorException::notConfigured('Payment gateway ('.$name.')'),
        };
    }

    /** درایور پیش‌فرض — با چک پیکربندی. */
    public function default(): PaymentGateway
    {
        return $this->driver();
    }
}
