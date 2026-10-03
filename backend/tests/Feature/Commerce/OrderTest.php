<?php

namespace Tests\Feature\Commerce;

use App\Models\Entitlement;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\BuildsCommerce;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * چرخهٔ عمر سفارش — فاز ۱۸.
 *
 * چیزی که اینجا سنجیده می‌شود «سفارش ساخته شد» نیست؛ این است که **کلاینت
 * نتواند مبلغ یا وضعیت را تعیین کند**، سفارش دیگری دیده نشود (۴۰۴ نه ۴۰۳)،
 * و کلید idempotency واقعاً در دیتابیس یکتا باشد.
 */
class OrderTest extends TestCase
{
    use BuildsCommerce, BuildsExams, BuildsQuestionBank, RefreshDatabase;

    public function test_order_total_is_built_from_server_pricing_and_client_amounts_are_ignored(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $order = $this->postJsonWithOrigin('/api/v1/orders', [
            'planId' => 'pro',
            'cycleId' => 'quarterly',
            'seats' => 1,
            /* هر ادعای مالیِ کلاینت باید بی‌اثر باشد (§22/§30/§52). */
            'amount' => 1,
            'total_minor' => 1,
            'price' => 0,
            'discount' => 100,
            'discountPercent' => 100,
            'currency' => 'USD',
            'status' => 'paid',
            'paid' => true,
            'entitlement' => 'intl',
            'userId' => User::query()->value('id'),
        ], $buyer['csrf'])->assertCreated()->json('data.order');

        /* round(449000 × 0.9) = 404100 → × ۳ ماه = 1,212,300 */
        $this->assertSame(1212300, $order['total_minor']);
        $this->assertSame('IRT', $order['currency']);
        $this->assertSame(Order::STATUS_PENDING, $order['status']);
        $this->assertNull($order['paid_at']);

        $stored = Order::query()->findOrFail($order['id']);

        $this->assertSame(1212300, $stored->total_minor);
        $this->assertSame('IRT', $stored->currency);
        $this->assertSame($buyer['user']->getKey(), $stored->user_id);

        /* snapshot عکس محاسبهٔ سرور است، نه ادعای کلاینت. */
        $this->assertSame(404100, $stored->quote_snapshot['per_month_minor']);
        $this->assertSame(1212300, $stored->quote_snapshot['total_minor']);
        $this->assertSame('quarterly', $stored->quote_snapshot['cycle']);
        /* تخفیف از خود طرح آمد (۱۰٪ چرخهٔ فصلی)، نه از ادعای `discount:100`. */
        $this->assertSame(10, $stored->quote_snapshot['discount_percent']);
        $this->assertSame(449000, $stored->quote_snapshot['list_per_month_minor']);

        /* ساخت سفارش هیچ پول و هیچ دسترسی‌ای تولید نمی‌کند. */
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseCount('subscriptions', 0);
        $this->assertDatabaseCount('entitlements', 0);

        /* و پاسخ هیچ شناسهٔ کاربری را القا نمی‌کند. */
        $this->assertArrayNotHasKey('user_id', $order);
    }

    public function test_idempotency_key_replays_the_same_order_instead_of_creating_a_second(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $first = $this->placeOrder($buyer, 'pro', 'monthly', 1, 'key-order-1');
        $second = $this->placeOrder($buyer, 'pro', 'monthly', 1, 'key-order-1');

        $this->assertSame($first, $second);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_lines', 1);
    }

    public function test_same_idempotency_key_with_a_different_payload_is_a_conflict(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $this->placeOrder($buyer, 'pro', 'monthly', 1, 'key-order-2');

        /* همان کلید، چرخهٔ متفاوت ⇒ ۴۰۹؛ بازنویسی بی‌صدا هرگز (§34). */
        $this->postJsonWithOrigin('/api/v1/orders', [
            'planId' => 'pro',
            'cycleId' => 'yearly',
            'seats' => 1,
        ], [...$buyer['csrf'], 'Idempotency-Key' => 'key-order-2'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'IDEMPOTENCY_KEY_REUSED');

        $this->assertDatabaseCount('orders', 1);
    }

    public function test_order_requires_a_session_and_rejects_cross_site_writes(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();

        /* بی‌سشن ⇒ ۴۰۱ */
        $this->postJsonWithOrigin('/api/v1/orders', ['planId' => 'pro', 'cycleId' => 'monthly'])
            ->assertStatus(401);

        $buyer = $this->signedInBuyer();

        /* سشن دارد ولی Origin ندارد ⇒ fail-closed (۴۰۳) */
        $this->postJson('/api/v1/orders', ['planId' => 'pro', 'cycleId' => 'monthly'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        /* Origin دارد ولی CSRF ندارد ⇒ ۴۰۳ */
        $this->postJsonWithOrigin('/api/v1/orders', ['planId' => 'pro', 'cycleId' => 'monthly'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'CSRF_FAILED');

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_another_users_order_is_not_found_never_forbidden(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();

        $alice = $this->signedInBuyer(['phone' => '09121110001']);
        $orderId = $this->placeOrder($alice);

        /* باب هم‌اکنون سشن فعال است. */
        $this->signedInBuyer(['phone' => '09121110002']);

        $this->getJson('/api/v1/me/orders/'.$orderId)->assertNotFound();
        $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/cancel', [], $this->csrfHeaderFromCurrent())
            ->assertNotFound();

        $this->assertSame(Order::STATUS_PENDING, Order::query()->findOrFail($orderId)->status);
    }

    public function test_me_lists_expose_only_the_current_users_commerce_data(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();

        $alice = $this->signedInBuyer(['phone' => '09121110003']);
        $aliceOrder = $this->placeOrder($alice);

        $aliceList = $this->getJson('/api/v1/me/orders')->assertOk();
        $this->assertSame([$aliceOrder], array_column($aliceList->json('data.orders'), 'id'));
        $this->assertArrayNotHasKey('user_id', $aliceList->json('data.orders.0'));

        /* باب وارد می‌شود — سشن alice جای خود را می‌دهد. */
        $this->signedInBuyer(['phone' => '09121110004']);

        $this->getJson('/api/v1/me/orders')->assertOk()->assertJsonCount(0, 'data.orders');
        $this->getJson('/api/v1/me/payments')->assertOk()->assertJsonCount(0, 'data.payments');
        $this->getJson('/api/v1/me/subscriptions')->assertOk()->assertJsonCount(0, 'data.subscriptions');
        $this->getJson('/api/v1/me/entitlements')->assertOk()->assertJsonCount(0, 'data.entitlements');
        $this->getJson('/api/v1/me/orders/'.$aliceOrder)->assertNotFound();
    }

    public function test_cancelling_an_open_order_works_once_and_then_the_order_is_terminal(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);

        $cancelled = $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/cancel', [], $buyer['csrf'])
            ->assertOk()->json('data.order');

        $this->assertSame(Order::STATUS_CANCELLED, $cancelled['status']);

        /* بار دوم: سفارش پایانی است ⇒ ۴۰۹ (نه لغو دوباره، نه ۵۰۰). */
        $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/cancel', [], $buyer['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ORDER_NOT_CANCELLABLE');

        /* سفارش لغوشده دیگر پرداخت نمی‌شود. */
        $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/payments', [], $buyer['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ORDER_NOT_PAYABLE');

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_expired_order_is_neither_payable_nor_cancellable(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);

        /* انقضا از **ساعت سرور** می‌آید؛ عقب‌بردن ساعت کلاینت اثری ندارد (§75). */
        Order::query()->whereKey($orderId)->update(['expires_at' => Carbon::now()->subMinute()]);

        $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/payments', [], $buyer['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ORDER_NOT_PAYABLE');

        $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/cancel', [], $buyer['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ORDER_NOT_CANCELLABLE');
    }

    public function test_open_order_limit_per_user_is_enforced_server_side(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        config(['commerce.orders.max_open_per_user' => 3]);

        $buyer = $this->signedInBuyer();

        for ($i = 0; $i < 3; $i++) {
            $this->placeOrder($buyer);
        }

        $this->postJsonWithOrigin('/api/v1/orders', ['planId' => 'pro', 'cycleId' => 'monthly'], $buyer['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'TOO_MANY_OPEN_ORDERS');

        $this->assertDatabaseCount('orders', 3);
    }

    public function test_unapproved_archived_and_unknown_plans_cannot_be_ordered(): void
    {
        $this->enableCommerce();

        $product = $this->makeProduct('pro', ['intl']);
        $this->makePlan($product, 'pro-monthly', 1, 449000, 0, null, approved: false);
        $this->makePlan($product, 'pro-quarterly', 3, 449000, 0, null, approved: true, status: Plan::STATUS_ARCHIVED);

        $buyer = $this->signedInBuyer();

        /* تأییدنشده ⇒ ۴۰۹ (کاتالوگ نشانش می‌دهد ولی نمی‌شود خرید). */
        $this->postJsonWithOrigin('/api/v1/orders', ['planId' => 'pro', 'cycleId' => 'monthly'], $buyer['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'PLAN_NOT_PURCHASABLE');

        /* آرشیو و ناشناخته ⇒ ۴۰۴، یکسان تا شمارش ممکن نباشد. */
        $this->postJsonWithOrigin('/api/v1/orders', ['planId' => 'pro', 'cycleId' => 'quarterly'], $buyer['csrf'])
            ->assertNotFound();

        $this->postJsonWithOrigin('/api/v1/orders', ['planId' => 'ghost', 'cycleId' => 'monthly'], $buyer['csrf'])
            ->assertNotFound();

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_checkout_disabled_returns_503_and_creates_nothing(): void
    {
        /* پیش‌فرض واقعی سیستم: خرید فعال نیست ⇒ نه سفارش، نه «موفق» جعلی. */
        config(['commerce.checkout.enabled' => false, 'commerce.gateway.sandbox.secret' => self::SANDBOX_SECRET]);

        $product = $this->makeProduct('pro', ['intl']);
        $this->makePlan($product, 'pro-monthly', 1, 449000);

        $buyer = $this->signedInBuyer();

        $this->postJsonWithOrigin('/api/v1/orders', ['planId' => 'pro', 'cycleId' => 'monthly'], $buyer['csrf'])
            ->assertStatus(503)
            ->assertJsonPath('error.code', 'FEATURE_NOT_CONFIGURED');

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_there_is_no_route_that_marks_an_order_paid(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();
        $orderId = $this->placeOrder($buyer);

        /* PATCH وضعیت ⇒ مسیر وجود ندارد (§48/§95). */
        $response = $this->patchJsonWithOrigin('/api/v1/orders/'.$orderId, ['status' => 'paid'], $buyer['csrf']);
        $this->assertTrue(
            in_array($response->status(), [404, 405], true),
            'هیچ مسیری نباید وضعیت سفارش را از کلاینت بپذیرد؛ پاسخ: '.$response->status(),
        );

        /* و حتی اگر مسیری بود، `pending → paid` فقط از finalize() ممکن است. */
        $this->assertSame(Order::STATUS_PENDING, Order::query()->findOrFail($orderId)->status);
        $this->assertSame(0, Entitlement::query()->count());
        $this->assertSame(0, Subscription::query()->count());
        $this->assertSame(0, Payment::query()->count());
    }

    /** هدر CSRF سشن فعالِ کلاینت تست (پس از ورود کاربر دوم). */
    private function csrfHeaderFromCurrent(): array
    {
        return [(string) config('identity.csrf.header') => (string) ($this->unencryptedCookies[(string) config('identity.cookies.csrf')] ?? '')];
    }
}
