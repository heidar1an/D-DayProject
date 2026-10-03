<?php

namespace App\Services\Commerce\Gateway;

/**
 * قرارداد آداپتور درگاه پرداخت — فاز ۱۸.
 *
 * چرا interface و نه کد مستقیم در سرویس: منطق کسب‌وکار (سفارش، تطبیق مبلغ،
 * entitlement) نباید به یک provider گره بخورد. با این قرارداد، تعویض درگاه فقط
 * یک کلاس تازه + یک کلید config است و هیچ خطی از `PaymentService` عوض نمی‌شود
 * (Prompt §37).
 *
 * ⚠️ هر پیاده‌سازی باید **fail-closed** باشد: اگر Secret تنظیم نشده باشد،
 * `ApiErrorException` با 503 پرتاب می‌شود و هرگز به مقدار پیش‌فرض حدس‌زدنی
 * برنمی‌گردد.
 */
interface PaymentGateway
{
    /** نام پایدار provider — همان مقداری که در `payments.provider` و مسیر webhook می‌نشیند. */
    public function name(): string;

    /**
     * ساخت تراکنش در درگاه.
     *
     * @param  int  $amountMinor  مبلغ **سرور-محاسبه‌شده**؛ از کلاینت نمی‌آید.
     * @return array{authority: string, redirect_url: string}
     */
    public function create(int $amountMinor, string $currency, string $orderId): array;

    /**
     * تأیید تراکنش.
     *
     * @param  string|null  $signature  شاهد رمزنگاری‌شدهٔ callback (اگر provider بدهد)
     * @return array{ok: bool, reference: string|null, amount_minor: int|null, reason: string|null}
     */
    public function verify(string $authority, int $amountMinor, ?string $signature): array;

    /**
     * اعتبارسنجی امضای Webhook.
     *
     * Webhook نباید به کوکی/سشن وابسته باشد؛ تنها شاهد معتبر، امضای provider است.
     *
     * @param  array<string, mixed>  $payload
     */
    public function verifyWebhook(array $payload, ?string $signature): bool;

    /**
     * آیا این provider همین حالا قابل استفاده است؟ (Secret تنظیم شده؟)
     * سرویس‌ها قبل از هر تماس این را می‌پرسند تا خطای ۵xx به‌جای 503 ندهند.
     */
    public function isConfigured(): bool;
}
