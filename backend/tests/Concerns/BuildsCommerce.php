<?php

namespace Tests\Concerns;

use App\Models\Payment;
use App\Models\Plan;
use App\Models\Product;
use App\Models\ProductCapability;
use App\Models\User;
use App\Services\Commerce\Gateway\SandboxGateway;
use Illuminate\Testing\TestResponse;

/**
 * ساخت دادهٔ Commerce برای تست‌ها — فاز ۱۸.
 *
 * چرا مستقیم از مدل و نه از seeder: تست باید بتواند **حالت‌های مرزی** بسازد
 * (طرح تأییدنشده، طرح آرشیو، قیمت صفر، قابلیت بدون فروشنده). seeder فقط حالت
 * سالم را می‌سازد؛ اگر تست هم فقط حالت سالم را ببیند، هیچ‌کدام از قیدهای
 * امنیتی سنجیده نمی‌شوند.
 *
 * ⚠️ اما پرداخت از مسیر **واقعی** درگاه عبور می‌کند: `sandbox()` همان آداپتور
 * production است، فقط Secret آن در تست ست می‌شود. امضا هم واقعاً HMAC است — نه
 * یک پرچم «موفق» که هیچ‌چیز را نمی‌سنجد.
 */
trait BuildsCommerce
{
    protected const SANDBOX_SECRET = 'test-sandbox-secret';

    /** فعال‌سازی checkout + entitlement + Secret درگاه برای یک تست. */
    protected function enableCommerce(bool $enforceEntitlements = true): void
    {
        config([
            'commerce.checkout.enabled' => true,
            'commerce.entitlements.enforce' => $enforceEntitlements,
            'commerce.gateway.sandbox.secret' => self::SANDBOX_SECRET,
        ]);
    }

    protected function sandbox(): SandboxGateway
    {
        return new SandboxGateway;
    }

    /** @param list<string> $capabilities */
    protected function makeProduct(string $sku = 'pro', array $capabilities = ['intl'], string $status = Product::STATUS_ACTIVE): Product
    {
        $product = new Product;
        $product->forceFill([
            'sku' => $sku,
            'kind' => Product::KIND_SUBSCRIPTION,
            'name' => 'محصول '.$sku,
            'status' => $status,
        ])->save();

        foreach ($capabilities as $code) {
            $this->addCapability($product, $code);
        }

        return $product;
    }

    protected function addCapability(Product $product, string $code, string $coverage = 'full'): ProductCapability
    {
        $capability = new ProductCapability;
        $capability->forceFill([
            'product_id' => $product->getKey(),
            'code' => $code,
            'coverage' => $coverage,
        ])->save();

        return $capability;
    }

    /**
     * @param  array<string, mixed>|null  $rules
     */
    protected function makePlan(
        Product $product,
        string $code = 'pro-monthly',
        int $months = 1,
        int $priceMinor = 449000,
        int $discountPercent = 0,
        ?array $rules = null,
        bool $approved = true,
        string $status = Plan::STATUS_ACTIVE,
    ): Plan {
        $plan = new Plan;
        $plan->forceFill([
            'code' => $code,
            'product_id' => $product->getKey(),
            'price_minor' => $priceMinor,
            'currency' => 'IRT',
            'cycle_months' => $months,
            'discount_percent' => $discountPercent,
            'pricing_rules' => $rules,
            'approved_at' => $approved ? now() : null,
            'status' => $status,
        ])->save();

        return $plan;
    }

    /**
     * کاتالوگ کامل و قابل خرید: یک محصول پرو با قابلیت `intl` + سه چرخه.
     *
     * @return array{product: Product, monthly: Plan, quarterly: Plan, yearly: Plan}
     */
    protected function makePurchasablePro(): array
    {
        $product = $this->makeProduct('pro', ['intl']);

        return [
            'product' => $product,
            'monthly' => $this->makePlan($product, 'pro-monthly', 1, 449000),
            'quarterly' => $this->makePlan($product, 'pro-quarterly', 3, 449000, 10),
            'yearly' => $this->makePlan($product, 'pro-yearly', 12, 449000, 20),
        ];
    }

    /** ساخت سفارش از مسیر واقعی API و بازگشت شناسهٔ آن. */
    protected function placeOrder(array $student, string $planId = 'pro', string $cycleId = 'monthly', int $seats = 1, ?string $key = null): string
    {
        $headers = [...$student['csrf']];

        if ($key !== null) {
            $headers['Idempotency-Key'] = $key;
        }

        return $this->postJsonWithOrigin('/api/v1/orders', [
            'planId' => $planId,
            'cycleId' => $cycleId,
            'seats' => $seats,
        ], $headers)->assertCreated()->json('data.order.id');
    }

    /** شروع پرداخت از مسیر واقعی و بازگشت authority. */
    protected function startPayment(array $student, string $orderId): string
    {
        return $this->postJsonWithOrigin(
            '/api/v1/orders/'.$orderId.'/payments',
            [],
            $student['csrf'],
        )->assertCreated()->json('data.payment.authority');
    }

    /** امضای «تأیید» درگاه شبیه‌سازی‌شده — همان چیزی که provider واقعی می‌فرستد. */
    protected function verifySignature(string $authority, int $amountMinor): string
    {
        return $this->sandbox()->sign("verify|{$authority}|{$amountMinor}");
    }

    protected function webhookSignature(string $eventId, string $authority, int $amountMinor, string $status): string
    {
        return $this->sandbox()->sign("webhook|{$eventId}|{$authority}|{$amountMinor}|{$status}");
    }

    /** @return array{user: User, session: mixed, csrf: array<string, string>} */
    protected function signedInBuyer(array $payload = ['phone' => '09121110000']): array
    {
        return $this->signedInStudent($payload);
    }

    /** شناسهٔ پرداخت یک سفارش (از دیتابیس، چون مسیر عمومی لیست پرداخت جدا دارد). */
    protected function paymentIdOf(string $orderId): string
    {
        return (string) Payment::query()->where('order_id', $orderId)->value('id');
    }

    protected function authorityOf(string $orderId): string
    {
        return (string) Payment::query()->where('order_id', $orderId)->value('authority');
    }

    /** تأیید پرداخت از مسیر واقعی API. */
    protected function verifyPayment(array $student, string $paymentId, ?string $signature): TestResponse
    {
        return $this->postJsonWithOrigin(
            '/api/v1/payments/'.$paymentId.'/verify',
            $signature === null ? [] : ['signature' => $signature],
            $student['csrf'],
        );
    }

    /**
     * ارسال Webhook از مسیر واقعی — با امضای داده‌شده (که تست می‌تواند جعلی بسازد).
     *
     * @param  array<string, mixed>  $overrides
     */
    protected function postWebhook(string $signature, array $overrides = [], string $provider = 'sandbox'): TestResponse
    {
        return $this->postJson('/api/v1/payments/webhook/'.$provider, [
            'event_id' => 'evt-1',
            'authority' => 'sbx-unknown',
            'amount_minor' => 449000,
            'status' => 'success',
            ...$overrides,
        ], ['X-Payment-Signature' => $signature]);
    }
}
