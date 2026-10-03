<?php

namespace App\Services\Commerce\Gateway;

use App\Exceptions\ApiErrorException;

/**
 * درگاه شبیه‌سازی‌شده (Sandbox) — فاز ۱۸.
 *
 * ⚠️ این درگاه **پرداخت واقعی انجام نمی‌دهد**. اما «تأیید» آن یک امضای واقعی
 * HMAC است، نه یک پرچم `success=true`. چرا این تفاوت حیاتی است: اگر تأیید
 * جعلیِ همیشه‌موفق بود، تست‌های «تطبیق مبلغ»، «جعل Webhook» و «جایگزینی
 * authority» همه بی‌معنا می‌شدند و ادعای امنیتی توخالی می‌ماند.
 *
 * قرارداد امضا (هر دو طرف با همان Secret از `.env`):
 *   verify  : HMAC-SHA256("verify|{authority}|{amount_minor}")
 *   webhook : HMAC-SHA256("webhook|{event_id}|{authority}|{amount_minor}|{status}")
 *
 * `isConfigured()` قبل از هر استفاده چک می‌شود؛ Secret خالی ⇒ 503، هرگز یک
 * مقدار پیش‌فرض حدس‌زدنی.
 */
final class SandboxGateway implements PaymentGateway
{
    public const NAME = 'sandbox';

    public function name(): string
    {
        return self::NAME;
    }

    public function isConfigured(): bool
    {
        return $this->secret() !== '';
    }

    public function create(int $amountMinor, string $currency, string $orderId): array
    {
        $this->assertConfigured();

        /*
         * `authority` باید یکتا و غیرقابل‌حدس باشد؛ UNIQUE ستون، تکرار را در
         * دیتابیس می‌بندد و ۳۲ بایت تصادفی حدس را بی‌معنا می‌کند.
         */
        $authority = 'sbx_'.bin2hex(random_bytes(16));

        return [
            'authority' => $authority,
            'redirect_url' => rtrim((string) config('commerce.gateway.sandbox.checkout_url'), '/').'/'.$authority,
        ];
    }

    public function verify(string $authority, int $amountMinor, ?string $signature): array
    {
        $this->assertConfigured();

        if (! is_string($signature) || $signature === '') {
            return ['ok' => false, 'reference' => null, 'amount_minor' => null, 'reason' => 'SIGNATURE_MISSING'];
        }

        $expected = $this->sign("verify|{$authority}|{$amountMinor}");

        if (! hash_equals($expected, $signature)) {
            return ['ok' => false, 'reference' => null, 'amount_minor' => null, 'reason' => 'SIGNATURE_MISMATCH'];
        }

        return [
            'ok' => true,
            /* مرجع درگاه — از خود authority مشتق می‌شود تا قابل ردیابی و یکتا باشد. */
            'reference' => 'sbx-ref-'.substr(hash('sha256', $authority), 0, 24),
            'amount_minor' => $amountMinor,
            'reason' => null,
        ];
    }

    /** @param array<string, mixed> $payload */
    public function verifyWebhook(array $payload, ?string $signature): bool
    {
        $this->assertConfigured();

        if (! is_string($signature) || $signature === '') {
            return false;
        }

        $eventId = (string) ($payload['event_id'] ?? '');
        $authority = (string) ($payload['authority'] ?? '');
        $amount = (string) ($payload['amount_minor'] ?? '');
        $status = (string) ($payload['status'] ?? '');

        if ($eventId === '' || $authority === '' || $status === '' || ! ctype_digit($amount)) {
            return false;
        }

        return hash_equals($this->sign("webhook|{$eventId}|{$authority}|{$amount}|{$status}"), $signature);
    }

    /**
     * امضای یک پیام با Secret درگاه.
     *
     * عمومی است تا تست‌ها بتوانند شاهد **واقعی** بسازند (و شاهد جعلی هم) —
     * تستی که امضا نمی‌سازد، چیزی را تأیید نمی‌کند.
     */
    public function sign(string $message): string
    {
        return hash_hmac('sha256', $message, $this->secret());
    }

    private function secret(): string
    {
        return (string) (config('commerce.gateway.sandbox.secret') ?? '');
    }

    private function assertConfigured(): void
    {
        if (! $this->isConfigured()) {
            throw ApiErrorException::notConfigured('Payment gateway (sandbox secret)');
        }
    }
}
