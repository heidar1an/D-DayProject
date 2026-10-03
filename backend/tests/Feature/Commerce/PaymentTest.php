<?php

namespace Tests\Feature\Commerce;

use App\Models\Entitlement;
use App\Models\InternationalCourse;
use App\Models\InternationalProvider;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentWebhook;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsCommerce;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * پرداخت — فاز ۱۸. **قلب مالی سیستم.**
 *
 * این فایل سه ادعا را می‌سنجد، نه بیشتر:
 *
 *   ۱. **هیچ entitlement‌ای بدون پرداخت تأییدشده صادر نمی‌شود** (§48/§49).
 *   ۲. **تطبیق مبلغ/ارز و امضای درگاه واقعاً بررسی می‌شوند** — یک `success=true`
 *      جعلی هیچ اثری ندارد (§40/§70).
 *   ۳. **تکرار (verify دوباره، webhook دوباره، verify+webhook) به یک وضعیت
 *      پایانی می‌رسد** — نه دو entitlement (§71/§72).
 */
class PaymentTest extends TestCase
{
    use BuildsCommerce, BuildsExams, BuildsQuestionBank, RefreshDatabase;

    public function test_verified_payment_marks_order_paid_and_grants_subscription_and_entitlement(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);

        $this->assertStringStartsWith('sbx_', $authority);

        $payment = $this->verifyPayment($buyer, $this->paymentIdOf($orderId), $this->verifySignature($authority, 449000))
            ->assertOk()->json('data.payment');

        $this->assertSame(Payment::STATUS_VERIFIED, $payment['status']);
        $this->assertSame(449000, $payment['amount_minor']);
        $this->assertSame('IRT', $payment['currency']);
        $this->assertNotNull($payment['verified_at']);

        /* سفارش paid شد و paid_at ست شد — هر دو با هم (قید دیتابیس). */
        $order = Order::query()->findOrFail($orderId);
        $this->assertSame(Order::STATUS_PAID, $order->status);
        $this->assertNotNull($order->paid_at);

        /* اشتراک فعال با پنجرهٔ یک‌ماهه. */
        $subscription = Subscription::query()->where('user_id', $buyer['user']->getKey())->sole();
        $this->assertSame(Subscription::STATUS_ACTIVE, $subscription->status);
        $this->assertTrue($subscription->isEffective());
        $this->assertSame((string) $orderId, (string) $subscription->source_order_id);
        $this->assertTrue($subscription->ends_at->greaterThan(now()->addDays(27)));

        /* entitlement فعال، هم‌پنجره با اشتراک، متصل به همان سفارش. */
        $entitlement = Entitlement::query()->where('user_id', $buyer['user']->getKey())->sole();
        $this->assertSame('intl', $entitlement->capability);
        $this->assertTrue($entitlement->isActive());
        $this->assertSame((string) $orderId, (string) $entitlement->source_order_id);
        $this->assertSame(
            $subscription->ends_at->toIso8601String(),
            $entitlement->ends_at->toIso8601String(),
        );

        /* و کاربر خودش هم می‌بیند. */
        $me = $this->getJson('/api/v1/me/entitlements')->assertOk();
        $this->assertSame(['intl'], $me->json('data.active_capabilities'));
        $this->assertTrue($me->json('data.entitlements.0.active'));
    }

    public function test_verify_is_idempotent_and_never_grants_a_second_entitlement(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);
        $paymentId = $this->paymentIdOf($orderId);
        $signature = $this->verifySignature($authority, 449000);

        $this->verifyPayment($buyer, $paymentId, $signature)->assertOk();
        $this->verifyPayment($buyer, $paymentId, $signature)->assertOk();
        /* حتی با امضای بی‌اعتبار: تراکنش بسته است، پس دوباره verify نمی‌شود. */
        $this->verifyPayment($buyer, $paymentId, 'forged')->assertOk();

        $this->assertSame(1, Payment::query()->count());
        $this->assertSame(1, Subscription::query()->count());
        $this->assertSame(1, Entitlement::query()->count());
        $this->assertSame(Order::STATUS_PAID, Order::query()->findOrFail($orderId)->status);
    }

    public function test_payment_is_refused_without_or_with_a_forged_signature(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        /*
         * هر سناریو سفارش تازهٔ خودش را می‌گیرد: نخستین شکست، سفارش را `failed`
         * می‌کند و verify دوباره روی سفارش پایانی ۴۰۹ می‌دهد (نه ۴۲۲). برای
         * سنجش خودِ اعتبارسنجی امضا، باید هر بار از صفر شروع کرد.
         */
        $cases = [
            'شاهد غایب' => fn (string $authority): ?string => null,
            'امضای جعلی' => fn (string $authority): ?string => 'deadbeef',
            /* امضای معتبر ولی برای **مبلغ دیگر** — امضا به مبلغ گره خورده است. */
            'مبلغ ناهم‌خوان' => fn (string $authority): ?string => $this->verifySignature($authority, 1000),
        ];

        foreach ($cases as $label => $makeSignature) {
            $orderId = $this->placeOrder($buyer);
            $authority = $this->startPayment($buyer, $orderId);
            $paymentId = $this->paymentIdOf($orderId);

            $this->verifyPayment($buyer, $paymentId, $makeSignature($authority))
                ->assertStatus(422)
                ->assertJsonPath('error.code', 'PAYMENT_VERIFICATION_FAILED');

            $this->assertSame(Payment::STATUS_FAILED, Payment::query()->findOrFail($paymentId)->status, $label);
            $this->assertSame(Order::STATUS_FAILED, Order::query()->findOrFail($orderId)->status, $label);
        }

        /* هیچ‌کدام از سه شکست، دسترسی یا اشتراک نساختند. */
        $this->assertSame(0, Subscription::query()->count());
        $this->assertSame(0, Entitlement::query()->count());
    }

    public function test_starting_a_payment_twice_replays_the_same_authority(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);

        $first = $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/payments', [], $buyer['csrf'])
            ->assertCreated();

        $second = $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/payments', [], $buyer['csrf'])
            ->assertOk();

        $this->assertFalse($first->json('data.replayed'));
        $this->assertTrue($second->json('data.replayed'));
        $this->assertSame($first->json('data.payment.authority'), $second->json('data.payment.authority'));
        $this->assertSame(1, Payment::query()->count());
    }

    public function test_client_supplied_amount_and_status_cannot_influence_the_payment(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);

        $payment = $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/payments', [
            'amount' => 1,
            'amount_minor' => 1,
            'status' => 'verified',
            'verified' => true,
            'currency' => 'USD',
        ], $buyer['csrf'])->assertCreated()->json('data.payment');

        $this->assertSame(449000, $payment['amount_minor']);
        $this->assertSame('IRT', $payment['currency']);
        $this->assertSame(Payment::STATUS_PENDING, $payment['status']);
        $this->assertNull($payment['verified_at']);
    }

    public function test_another_users_payment_is_not_found(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();

        $alice = $this->signedInBuyer(['phone' => '09121110011']);
        $orderId = $this->placeOrder($alice);
        $authority = $this->startPayment($alice, $orderId);
        $paymentId = $this->paymentIdOf($orderId);

        $this->signedInBuyer(['phone' => '09121110012']);

        $this->postJsonWithOrigin('/api/v1/payments/'.$paymentId.'/verify', [
            'signature' => $this->verifySignature($authority, 449000),
        ], $this->csrfHeaderFromCurrent())->assertNotFound();

        /* سفارش آلیس دست‌نخورده ماند. */
        $this->assertSame(Order::STATUS_AWAITING_PAYMENT, Order::query()->findOrFail($orderId)->status);
        $this->assertSame(0, Entitlement::query()->count());
    }

    public function test_webhook_with_a_valid_signature_verifies_the_payment_without_any_session(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);

        /*
         * عمداً بدون کوکی، بدون Origin، بدون CSRF — مثل درگاه واقعی.
         * `postWebhook` خودش از `postJson` ساده استفاده می‌کند.
         */
        $this->forgetCookies();

        $response = $this->postWebhook(
            $this->webhookSignature('evt-1', $authority, 449000, 'success'),
            ['authority' => $authority],
        )->assertOk();

        $this->assertSame('processed', $response->json('data.status'));
        $this->assertSame('PAYMENT_VERIFIED', $response->json('data.result'));

        $this->assertSame(Order::STATUS_PAID, Order::query()->findOrFail($orderId)->status);
        $this->assertSame(Payment::STATUS_VERIFIED, Payment::query()->findOrFail($this->paymentIdOf($orderId))->status);
        $this->assertSame(1, Entitlement::query()->count());
        $this->assertSame(1, Subscription::query()->count());
    }

    public function test_webhook_replay_is_a_no_op_and_never_grants_twice(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);
        $signature = $this->webhookSignature('evt-replay', $authority, 449000, 'success');

        $this->postWebhook($signature, ['authority' => $authority, 'event_id' => 'evt-replay'])
            ->assertOk()->assertJsonPath('data.result', 'PAYMENT_VERIFIED');

        /* همان رخداد، دوباره — درگاه retry می‌کند تا «موفق» ببیند. */
        $this->postWebhook($signature, ['authority' => $authority, 'event_id' => 'evt-replay'])
            ->assertOk()->assertJsonPath('data.result', 'REPLAY_IGNORED');

        $this->assertSame(1, Entitlement::query()->count());
        $this->assertSame(1, PaymentWebhook::query()->count());
    }

    public function test_webhook_with_an_invalid_signature_has_no_effect_at_all(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);

        $this->postWebhook('not-a-real-signature', ['authority' => $authority, 'event_id' => 'evt-bad-1'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        /* امضای درست، ولی برای event_id دیگری ⇒ همان رد (امضا به بدنه گره خورده). */
        $this->postWebhook(
            $this->webhookSignature('evt-other', $authority, 449000, 'success'),
            ['authority' => $authority, 'event_id' => 'evt-bad-2'],
        )->assertStatus(403);

        $this->assertSame(Order::STATUS_AWAITING_PAYMENT, Order::query()->findOrFail($orderId)->status);
        $this->assertSame(Payment::STATUS_PENDING, Payment::query()->findOrFail($this->paymentIdOf($orderId))->status);
        $this->assertSame(0, Entitlement::query()->count());

        /* رخدادهای ردشده ثبت شده‌اند تا قابل ردیابی باشند. */
        $this->assertSame(2, PaymentWebhook::query()->where('status', PaymentWebhook::STATUS_REJECTED)->count());
    }

    public function test_webhook_amount_mismatch_is_rejected_and_grants_nothing(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);

        /* امضا معتبر است (چون برای همان مبلغِ ادعایی ساخته شده) ولی مبلغ با سفارش نمی‌خواند. */
        $this->postWebhook(
            $this->webhookSignature('evt-cheap', $authority, 1000, 'success'),
            ['authority' => $authority, 'event_id' => 'evt-cheap', 'amount_minor' => 1000],
        )->assertOk()->assertJsonPath('data.result', 'AMOUNT_MISMATCH');

        $this->assertSame(Order::STATUS_AWAITING_PAYMENT, Order::query()->findOrFail($orderId)->status);
        $this->assertSame(Payment::STATUS_PENDING, Payment::query()->findOrFail($this->paymentIdOf($orderId))->status);
        $this->assertSame(0, Entitlement::query()->count());
        $this->assertSame(0, Subscription::query()->count());
    }

    public function test_webhook_with_an_unknown_authority_is_rejected_not_500(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();

        $this->postWebhook(
            $this->webhookSignature('evt-ghost', 'sbx-does-not-exist', 449000, 'success'),
            ['authority' => 'sbx-does-not-exist', 'event_id' => 'evt-ghost'],
        )->assertOk()->assertJsonPath('data.result', 'UNKNOWN_AUTHORITY');

        $this->assertSame(0, Entitlement::query()->count());
    }

    public function test_webhook_for_an_unknown_provider_is_404(): void
    {
        $this->enableCommerce();

        $this->postJson('/api/v1/payments/webhook/stripe', [
            'event_id' => 'evt-1',
            'authority' => 'x',
            'amount_minor' => 1000,
            'status' => 'success',
        ], ['X-Payment-Signature' => 'whatever'])->assertNotFound();
    }

    public function test_webhook_without_event_id_is_rejected_by_validation(): void
    {
        $this->enableCommerce();

        $this->postJson('/api/v1/payments/webhook/sandbox', [
            'authority' => 'sbx-1',
            'amount_minor' => 1000,
            'status' => 'success',
        ], ['X-Payment-Signature' => 'whatever'])
            ->assertStatus(422)
            ->assertFieldError('event_id');
    }

    public function test_same_event_id_with_a_different_payload_is_a_conflict(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);

        $this->postWebhook(
            $this->webhookSignature('evt-dup', $authority, 449000, 'success'),
            ['authority' => $authority, 'event_id' => 'evt-dup'],
        )->assertOk();

        /* همان event_id، بدنهٔ متفاوت ⇒ ۴۰۹؛ اثر دوباره اعمال نمی‌شود. */
        $this->postWebhook(
            $this->webhookSignature('evt-dup', $authority, 1000, 'success'),
            ['authority' => $authority, 'event_id' => 'evt-dup', 'amount_minor' => 1000],
        )->assertStatus(409)->assertJsonPath('error.code', 'WEBHOOK_PAYLOAD_MISMATCH');

        $this->assertSame(1, PaymentWebhook::query()->count());
        $this->assertSame(1, Entitlement::query()->count());
    }

    public function test_webhook_first_then_verify_converges_to_a_single_entitlement(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);
        $paymentId = $this->paymentIdOf($orderId);

        /* webhook جلو می‌زند (race قانونی) */
        $this->postWebhook(
            $this->webhookSignature('evt-race', $authority, 449000, 'success'),
            ['authority' => $authority, 'event_id' => 'evt-race'],
        )->assertOk();

        /* بعد مرورگر verify می‌کند ⇒ باید no-op باشد، نه entitlement دوم. */
        $this->verifyPayment($buyer, $paymentId, $this->verifySignature($authority, 449000))->assertOk();

        $this->assertSame(1, Entitlement::query()->count());
        $this->assertSame(1, Subscription::query()->count());
        $this->assertSame(Order::STATUS_PAID, Order::query()->findOrFail($orderId)->status);

        /* و بار سوم: رخداد تازه با همان authority ⇒ ALREADY_VERIFIED. */
        $this->postWebhook(
            $this->webhookSignature('evt-race-2', $authority, 449000, 'success'),
            ['authority' => $authority, 'event_id' => 'evt-race-2'],
        )->assertOk()->assertJsonPath('data.result', 'ALREADY_VERIFIED');

        $this->assertSame(1, Entitlement::query()->count());
    }

    public function test_paid_order_is_terminal_for_cancel_and_for_new_payments(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $buyer = $this->signedInBuyer();

        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);

        $this->verifyPayment($buyer, $this->paymentIdOf($orderId), $this->verifySignature($authority, 449000))
            ->assertOk();

        $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/cancel', [], $buyer['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ORDER_NOT_CANCELLABLE');

        $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/payments', [], $buyer['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ORDER_NOT_PAYABLE');

        $this->assertSame(1, Payment::query()->count());
        $this->assertSame(1, Entitlement::query()->count());
    }

    public function test_gateway_without_a_secret_returns_503_and_never_fakes_success(): void
    {
        config([
            'commerce.checkout.enabled' => true,
            'commerce.gateway.sandbox.secret' => null,
        ]);

        $product = $this->makeProduct('pro', ['intl']);
        $this->makePlan($product, 'pro-monthly', 1, 449000);

        $buyer = $this->signedInBuyer();
        $orderId = $this->placeOrder($buyer);

        $this->postJsonWithOrigin('/api/v1/orders/'.$orderId.'/payments', [], $buyer['csrf'])
            ->assertStatus(503)
            ->assertJsonPath('error.code', 'FEATURE_NOT_CONFIGURED');

        $this->assertSame(0, Payment::query()->count());
        $this->assertSame(0, Entitlement::query()->count());
    }

    public function test_a_verified_entitlement_unlocks_the_premium_international_course(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $this->premiumCourse('premium-global-health', 'intl');

        /* مهمان: کاتالوگ را می‌بیند ولی جزئیات قفل است ⇒ ۴۰۳ صریح. */
        $this->getJson('/api/v1/international/courses/premium-global-health')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'ENTITLEMENT_REQUIRED');

        $buyer = $this->signedInBuyer();

        /* کاربر بدون entitlement هم قفل است. */
        $this->getJson('/api/v1/international/courses/premium-global-health')->assertStatus(403);

        /* حالا خرید واقعی. */
        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);
        $this->verifyPayment($buyer, $this->paymentIdOf($orderId), $this->verifySignature($authority, 449000))
            ->assertOk();

        /* همان درخواست، حالا باز است. */
        $course = $this->getJson('/api/v1/international/courses/premium-global-health')
            ->assertOk()->json('data.course');

        $this->assertSame('premium-global-health', $course['slug']);
        $this->assertFalse($course['locked']);
        $this->assertSame('intl', $course['required_capability']);

        /* در فهرست هم `locked:false` است. */
        $list = $this->getJson('/api/v1/international/courses')->assertOk()->json('data.courses');
        $this->assertFalse($list[0]['locked']);
    }

    public function test_expired_entitlement_no_longer_unlocks_the_course(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();
        $this->premiumCourse('premium-expiring', 'intl');

        $buyer = $this->signedInBuyer();
        $orderId = $this->placeOrder($buyer);
        $authority = $this->startPayment($buyer, $orderId);
        $this->verifyPayment($buyer, $this->paymentIdOf($orderId), $this->verifySignature($authority, 449000))
            ->assertOk();

        $this->getJson('/api/v1/international/courses/premium-expiring')->assertOk();

        /*
         * بدون هیچ Cron و بدون هیچ refresh سمت کلاینت: فقط گذشت زمان.
         * دسترسی از `ends_at` بسته می‌شود، نه از یک پرچم دستی (§75).
         *
         * `starts_at` هم عقب می‌رود چون قید `period_valid` نمی‌گذارد `ends_at`
         * پیش از `starts_at` بنشیند — همان قیدی که «پنجرهٔ وارونه» را در
         * دیتابیس غیرقابل‌درج می‌کند.
         */
        Entitlement::query()->update(['starts_at' => now()->subDays(2), 'ends_at' => now()->subMinute()]);
        Subscription::query()->update(['starts_at' => now()->subDays(2), 'ends_at' => now()->subMinute()]);

        $this->getJson('/api/v1/international/courses/premium-expiring')->assertStatus(403);

        $me = $this->getJson('/api/v1/me/entitlements')->assertOk();
        $this->assertSame([], $me->json('data.active_capabilities'));
        $this->assertFalse($me->json('data.entitlements.0.active'));

        /* گزارش اشتراک هم با واقعیت یکی می‌شود. */
        $this->getJson('/api/v1/me/subscriptions')
            ->assertOk()
            ->assertJsonPath('data.subscriptions.0.status', Subscription::STATUS_EXPIRED);
    }

    /** دورهٔ پرمیوم منتشرشده با ناشری منتشرشده. */
    private function premiumCourse(string $slug, string $capability): InternationalCourse
    {
        $provider = new InternationalProvider;
        $provider->forceFill([
            'slug' => 'harvard',
            'name' => 'دانشگاه هاروارد',
            'name_en' => 'Harvard University',
            'kind' => InternationalProvider::KIND_UNIVERSITY,
            'country' => 'ایالات متحده',
            'focus' => ['سلامت عمومی'],
            'sort_order' => 1,
            'status' => InternationalProvider::STATUS_PUBLISHED,
            'origin' => 'tapesh',
            'published_at' => now(),
        ])->save();

        $course = new InternationalCourse;
        $course->forceFill([
            'slug' => $slug,
            'provider_id' => $provider->getKey(),
            'title' => 'سلامت جهانی',
            'description' => 'دورهٔ پرمیوم بین‌الملل',
            'category' => 'medicine',
            'level' => 'مقدماتی',
            'tags' => ['سلامت عمومی'],
            'required_capability' => $capability,
            'sort_order' => 1,
            'status' => InternationalCourse::STATUS_PUBLISHED,
            'origin' => 'panel',
            'published_at' => now(),
        ])->save();

        return $course;
    }

    /** هدر CSRF سشن فعالِ کلاینت تست (پس از ورود کاربر دوم). */
    private function csrfHeaderFromCurrent(): array
    {
        return [(string) config('identity.csrf.header') => (string) ($this->unencryptedCookies[(string) config('identity.cookies.csrf')] ?? '')];
    }
}
