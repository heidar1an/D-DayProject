<?php

namespace Tests\Feature\Commerce;

use App\Models\Plan;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsCommerce;
use Tests\TestCase;

/**
 * قیمت‌گذاری و Quote — فاز ۱۸.
 *
 * مهم‌ترین چیزی که اینجا سنجیده می‌شود: **مبلغ سمت سرور ساخته می‌شود**. تست‌ها
 * عمداً `amount`/`price`/`currency`/`discount` می‌فرستند تا ثابت شود نادیده
 * گرفته می‌شوند (§22/§52).
 */
class PricingTest extends TestCase
{
    use BuildsCommerce, RefreshDatabase;

    private function groupSeats(): array
    {
        return (array) config('commerce.group_seats');
    }

    public function test_plans_endpoint_exposes_only_active_catalog_with_honest_approval_flags(): void
    {
        $this->enableCommerce();

        $pro = $this->makeProduct('pro', ['intl']);
        $this->makePlan($pro, 'pro-monthly', 1, 449000, 0, null, approved: true);

        $regular = $this->makeProduct('regular');
        $this->makePlan($regular, 'regular-monthly', 1, 249000, 0, null, approved: false);

        $archived = $this->makeProduct('legacy', [], Product::STATUS_ARCHIVED);
        $this->makePlan($archived, 'legacy-monthly', 1, 100000, 0, null, approved: true);

        $response = $this->getJson('/api/v1/pricing/plans')->assertOk();

        $skus = array_column($response->json('data.plans'), 'id');
        sort($skus);

        /* محصول آرشیو اصلاً در کاتالوگ نیست. */
        $this->assertSame(['pro', 'regular'], $skus);

        $plans = collect($response->json('data.plans'))->keyBy('id');

        $this->assertTrue($plans['pro']['approved']);
        $this->assertTrue($plans['pro']['purchasable']);
        $this->assertFalse($plans['regular']['approved']);
        $this->assertFalse($plans['regular']['purchasable']);

        /* چون یک طرح تأییدنشده وجود دارد، کل کاتالوگ صادقانه می‌گوید «قطعی نیست». */
        $this->assertFalse($response->json('data.amountsConfirmed'));
        $this->assertSame('IRT', $response->json('data.currency'));
        $this->assertSame(['intl'], array_column($plans['pro']['capabilities'], 'code'));
    }

    public function test_quote_matches_the_frontend_pricing_algorithm(): void
    {
        $this->enableCommerce();
        $catalog = $this->makePurchasablePro();

        $monthly = $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'pro', 'cycleId' => 'monthly', 'seats' => 1])
            ->assertOk()->json('data.quote');

        $this->assertSame(449000, $monthly['per_month_minor']);
        $this->assertSame(449000, $monthly['total_minor']);
        $this->assertSame(0, $monthly['discount_percent']);

        $quarterly = $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'pro', 'cycleId' => 'quarterly', 'seats' => 1])
            ->assertOk()->json('data.quote');

        /* round(449000 × 0.9) = 404100 → × 3 ماه */
        $this->assertSame(404100, $quarterly['per_month_minor']);
        $this->assertSame(1212300, $quarterly['total_minor']);
        $this->assertSame(1347000, $quarterly['list_total_minor']);
        $this->assertSame(134700, $quarterly['saved_total_minor']);

        $yearly = $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'pro', 'cycleId' => 'yearly', 'seats' => 1])
            ->assertOk()->json('data.quote');

        $this->assertSame(359200, $yearly['per_month_minor']);
        $this->assertSame(4310400, $yearly['total_minor']);
        $this->assertSame($catalog['yearly']->code, 'pro-yearly');
    }

    public function test_client_supplied_amount_is_ignored_entirely(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();

        $quote = $this->postJsonWithOrigin('/api/v1/pricing/quote', [
            'planId' => 'pro',
            'cycleId' => 'monthly',
            'seats' => 1,
            /* همهٔ این‌ها باید نادیده گرفته شوند. */
            'amount' => 1,
            'price' => 0,
            'total_minor' => 1,
            'discount' => 100,
            'discountPercent' => 99,
            'currency' => 'USD',
            'paid' => true,
            'entitlement' => 'intl',
        ])->assertOk()->json('data.quote');

        $this->assertSame(449000, $quote['total_minor']);
        $this->assertSame(0, $quote['discount_percent']);
        $this->assertSame('IRT', $quote['currency']);
    }

    public function test_group_plan_uses_seat_ladder_and_never_stacks_cycle_discount(): void
    {
        $this->enableCommerce();

        $group = $this->makeProduct('group', ['intl']);
        $this->makePlan($group, 'group-monthly', 1, 199000, 0, ['seats' => $this->groupSeats()]);
        $this->makePlan($group, 'group-quarterly', 3, 199000, 10, ['seats' => $this->groupSeats()]);

        $two = $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'group', 'cycleId' => 'monthly', 'seats' => 2])
            ->assertOk()->json('data.quote');

        $this->assertSame(15, $two['discount_percent']);
        $this->assertSame(169150, $two['per_month_minor']);
        $this->assertSame(338300, $two['total_minor']);

        $threeQuarterly = $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'group', 'cycleId' => 'quarterly', 'seats' => 3])
            ->assertOk()->json('data.quote');

        /* تخفیف چرخه (۱۰٪) روی پلن صندلی‌دار اعمال نمی‌شود؛ فقط نردبان صندلی. */
        $this->assertSame(30, $threeQuarterly['discount_percent']);
        $this->assertSame(139300, $threeQuarterly['per_month_minor']);
        $this->assertSame(1253700, $threeQuarterly['total_minor']);
        $this->assertSame(1791000, $threeQuarterly['list_total_minor']);
    }

    public function test_seats_out_of_range_or_on_single_seat_plan_is_rejected(): void
    {
        $this->enableCommerce();

        $pro = $this->makeProduct('pro');
        $this->makePlan($pro, 'pro-monthly', 1, 449000);

        /* پلن تک‌نفره با seats=3 ⇒ ۴۲۲ (نه clamp بی‌صدا به ۱). */
        $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'pro', 'cycleId' => 'monthly', 'seats' => 3])
            ->assertStatus(422)
            ->assertFieldError('seats');

        $group = $this->makeProduct('group');
        $this->makePlan($group, 'group-monthly', 1, 199000, 0, ['seats' => $this->groupSeats()]);

        $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'group', 'cycleId' => 'monthly', 'seats' => 1])
            ->assertStatus(422)
            ->assertFieldError('seats');

        $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'group', 'cycleId' => 'monthly', 'seats' => 9])
            ->assertStatus(422)
            ->assertFieldError('seats');
    }

    public function test_unknown_cycle_plan_and_mismatched_combination_are_rejected(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();

        $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'pro', 'cycleId' => 'weekly'])
            ->assertStatus(422)->assertFieldError('cycleId');

        $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'ghost', 'cycleId' => 'monthly'])
            ->assertNotFound();

        /* طرح آرشیو وجود ندارد — نه در کاتالوگ، نه در quote. */
        $archived = $this->makeProduct('old');
        $this->makePlan($archived, 'old-monthly', 1, 1000, 0, null, approved: true, status: Plan::STATUS_ARCHIVED);

        $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'old', 'cycleId' => 'monthly'])
            ->assertNotFound();
    }

    public function test_plan_id_must_be_a_slug_never_sql_or_path_injection(): void
    {
        $this->enableCommerce();
        $this->makePurchasablePro();

        foreach (["pro'; drop table plans; --", '../../etc/passwd', 'pro%20monthly'] as $payload) {
            $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => $payload, 'cycleId' => 'monthly'])
                ->assertStatus(422)
                ->assertFieldError('planId');
        }

        /* جدول‌ها سرجایشان‌اند. */
        $this->assertDatabaseCount('plans', 3);
    }

    public function test_quote_reports_approval_and_checkout_state_without_leaking_secrets(): void
    {
        $this->enableCommerce();
        $product = $this->makeProduct('pro', ['intl']);
        $this->makePlan($product, 'pro-monthly', 1, 449000, 0, null, approved: false);

        $quote = $this->postJsonWithOrigin('/api/v1/pricing/quote', ['planId' => 'pro', 'cycleId' => 'monthly'])
            ->assertOk()->json('data.quote');

        $this->assertFalse($quote['approved']);
        $this->assertFalse($quote['purchasable']);

        /* هیچ کلید/Secret در پاسخ نیست. */
        $body = json_encode($quote);
        $this->assertStringNotContainsString(self::SANDBOX_SECRET, (string) $body);
        $this->assertStringNotContainsString('secret', (string) $body);
    }

    public function test_catalog_is_served_even_when_gateway_is_unconfigured(): void
    {
        /* کاتالوگ و ماتریس قابلیت نمایشی است؛ نبود Secret نباید صفحه را ۵۰۰ کند. */
        config(['commerce.checkout.enabled' => false, 'commerce.gateway.sandbox.secret' => null]);

        $product = $this->makeProduct('pro', ['intl']);
        $this->makePlan($product, 'pro-monthly', 1, 449000);

        $response = $this->getJson('/api/v1/pricing/plans')->assertOk();

        $this->assertFalse($response->json('data.checkout.enabled'));
        $this->assertFalse($response->json('data.checkout.configured'));
        $this->assertSame('sandbox', $response->json('data.checkout.gateway'));
    }
}
