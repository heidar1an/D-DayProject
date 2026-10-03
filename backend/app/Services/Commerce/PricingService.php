<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiErrorException;
use App\Models\Plan;
use App\Services\Commerce\Gateway\GatewayManager;

/**
 * قیمت‌گذاری — فاز ۱۸. **تنها** جای محاسبهٔ مبلغ.
 *
 * اصل: کلاینت فقط *قصد* می‌فرستد (محصول، چرخه، تعداد صندلی). قیمت، تخفیف و
 * مبلغ نهایی همیشه از دیتابیس و همین الگوریتم می‌آید. اگر روزی کلاینت
 * `amount` هم بفرستد، این سرویس آن را **نمی‌بیند** — چون امضای متدها ورودی
 * مبلغ ندارند (Prompt §22/§30/§52).
 *
 * الگوریتم عیناً همان الگوریتم لایهٔ فعلی UI است
 * (`services/pricing/pricingService.js: quote()`)، تا هنگام cutover عدد نمایش‌داده‌شده
 * با عدد سرور یکی باشد:
 *
 *     perMonth = round(price_month * (1 - discount/100))
 *     perSeatTotal = perMonth * months
 *     total = perSeatTotal * seats
 *
 * نکتهٔ پلن گروهی: تخفیف چرخه روی پلن صندلی‌دار اعمال **نمی‌شود**؛ تخفیف از
 * نردبان صندلی می‌آید. جمع‌کردن دو تخفیف یعنی وعدهٔ مبلغی که هرگز محاسبه
 * نمی‌شود — همان چیزی که UI فعلی هم عمداً از آن پرهیز کرده است.
 */
class PricingService
{
    public function __construct(private readonly GatewayManager $gateways) {}

    public function currency(): string
    {
        return (string) config('commerce.currency.code');
    }

    public function currencyLabel(): string
    {
        return (string) config('commerce.currency.label');
    }

    public function isCheckoutEnabled(): bool
    {
        return (bool) config('commerce.checkout.enabled');
    }

    /** شناسهٔ چرخه → تعداد ماه. `null` یعنی چرخهٔ ناشناخته. */
    public function monthsForCycle(string $cycleId): ?int
    {
        $months = array_search($cycleId, (array) config('commerce.cycles'), true);

        return $months === false ? null : (int) $months;
    }

    public function cycleIdForMonths(int $months): ?string
    {
        $id = ((array) config('commerce.cycles'))[$months] ?? null;

        return is_string($id) ? $id : null;
    }

    /**
     * حل طرح از روی «sku محصول» + «شناسهٔ چرخه».
     *
     * چرا نه UUID: هویت طرح در قرارداد UI، ترکیب `planId` (که همان sku محصول
     * است) و `cycleId` است. نگاشت به UUID داخلی اینجا انجام می‌شود تا هیچ
     * شناسهٔ داخلی به کلاینت لو نرود و قرارداد UI دست‌نخورده بماند.
     */
    public function resolvePlan(string $productSku, string $cycleId): Plan
    {
        $months = $this->monthsForCycle($cycleId);

        if ($months === null) {
            throw ApiErrorException::invalid(['cycleId' => ['UNKNOWN_CYCLE']]);
        }

        $plan = Plan::query()
            ->visibleInCatalog()
            ->where('cycle_months', $months)
            ->whereHas('product', fn ($query) => $query->where('sku', $productSku))
            ->with(['product.capabilities'])
            ->first();

        if ($plan === null) {
            /* طرح ناموجود و طرح مخفی یک پاسخ می‌گیرند: هیچ شمارشی ممکن نباشد. */
            throw new ApiErrorException('PLAN_NOT_FOUND', 404, 'Plan not found.');
        }

        return $plan;
    }

    /** طرح قابل‌خرید یا ۴۰۹/۵۰۳. تنها دروازهٔ «اجازهٔ خرید». */
    public function assertPurchasable(Plan $plan): void
    {
        if (! $this->isCheckoutEnabled()) {
            /* خرید واقعی هنوز فعال نشده — نه خطای کلاینت، نه «موفق» جعلی. */
            throw ApiErrorException::notConfigured('Checkout');
        }

        if (! $plan->isPurchasable()) {
            throw new ApiErrorException(
                'PLAN_NOT_PURCHASABLE',
                409,
                'This plan is not available for purchase.',
            );
        }
    }

    /**
     * محاسبهٔ کامل قیمت — تنها منبع مبلغ.
     *
     * @return array<string, mixed> مقدار برگشتی همان چیزی است که در
     *                              `orders.quote_snapshot` می‌نشیند.
     */
    public function quote(Plan $plan, string $cycleId, int $seats): array
    {
        $months = $this->monthsForCycle($cycleId);

        if ($months === null || $months !== (int) $plan->cycle_months) {
            throw ApiErrorException::invalid(['cycleId' => ['CYCLE_PLAN_MISMATCH']]);
        }

        $seatCount = $this->resolveSeats($plan, $seats);
        $discountPercent = $this->discountPercent($plan, $seatCount);

        $listPerMonth = (int) $plan->price_minor;
        $perMonth = (int) round($listPerMonth * (1 - $discountPercent / 100));
        $perSeatTotal = $perMonth * $months;
        $total = $perSeatTotal * $seatCount;
        $listTotal = $listPerMonth * $months * $seatCount;

        return [
            'product' => $plan->product?->sku,
            'product_name' => $plan->product?->name,
            'plan' => $plan->code,
            'plan_id' => $plan->getKey(),
            'cycle' => $cycleId,
            'months' => $months,
            'seats' => $seatCount,
            'discount_percent' => $discountPercent,
            'list_per_month_minor' => $listPerMonth,
            'per_month_minor' => $perMonth,
            'per_seat_total_minor' => $perSeatTotal,
            'total_minor' => $total,
            'list_total_minor' => $listTotal,
            'saved_total_minor' => $listTotal - $total,
            'currency' => (string) $plan->currency,
            /* وضعیت واقعی خرید — UI باید بتواند صادقانه بگوید «فعلاً قابل خرید نیست». */
            'approved' => $plan->isApproved(),
            'purchasable' => $plan->isPurchasable() && $this->isCheckoutEnabled(),
        ];
    }

    /**
     * تعداد صندلی — clamp سمت سرور، نه اعتماد به کلاینت.
     *
     * طرح بدون نردبان صندلی فقط یک صندلی می‌فروشد؛ اگر کلاینت `seats=3` بفرستد
     * ۴۲۲ می‌گیرد (نه اینکه بی‌صدا ۱ شود و مبلغ غافلگیرکننده برگردد).
     */
    private function resolveSeats(Plan $plan, int $seats): int
    {
        $rules = $this->seatRules($plan);

        if ($rules === null) {
            if ($seats > 1) {
                throw ApiErrorException::invalid(['seats' => ['SEATS_NOT_ALLOWED']]);
            }

            return 1;
        }

        if ($seats < $rules['min'] || $seats > $rules['max']) {
            throw ApiErrorException::invalid(['seats' => ['SEATS_OUT_OF_RANGE']]);
        }

        return $seats;
    }

    private function discountPercent(Plan $plan, int $seats): int
    {
        $rules = $this->seatRules($plan);

        if ($rules !== null) {
            return (int) ($rules['discounts'][(string) $seats] ?? $rules['discounts'][$seats] ?? 0);
        }

        return (int) $plan->discount_percent;
    }

    /**
     * نردبان صندلی یک طرح — از `pricing_rules.seats`.
     *
     * چرا jsonb و نه ستون: این داده فقط برای یک طرح (گروهی) معنا دارد و هرگز
     * در WHERE نمی‌آید؛ همان تصمیمی که برای `exams.rules` گرفته شد.
     *
     * @return array{min:int,max:int,default:int,discounts:array<int|string,int>}|null
     */
    private function seatRules(Plan $plan): ?array
    {
        $rules = is_array($plan->pricing_rules) ? ($plan->pricing_rules['seats'] ?? null) : null;

        if (! is_array($rules) || ! isset($rules['min'], $rules['max'])) {
            return null;
        }

        return [
            'min' => (int) $rules['min'],
            'max' => (int) $rules['max'],
            'default' => (int) ($rules['default'] ?? $rules['min']),
            'discounts' => is_array($rules['discounts'] ?? null) ? $rules['discounts'] : [],
        ];
    }

    /**
     * کاتالوگ عمومی — فقط محصول/طرح فعال.
     *
     * طرح `draft`/`archived` هرگز اینجا نمی‌آید (§29). طرح فعالِ **تأییدنشده**
     * می‌آید ولی با `approved:false` و `purchasable:false` — چون UI باید ماتریس
     * قابلیت‌ها را نشان دهد و در همان حال صادقانه بگوید مبلغ نهایی نیست.
     * نمایش ≠ اجازهٔ خرید؛ این دو جدا هستند و هیچ‌کدام جعل نمی‌شود.
     *
     * @return array<string, mixed>
     */
    public function catalog(): array
    {
        $plans = Plan::query()
            ->visibleInCatalog()
            ->with(['product.capabilities'])
            ->orderBy('cycle_months')
            ->get();

        $byProduct = [];

        foreach ($plans as $plan) {
            $product = $plan->product;

            if ($product === null) {
                continue;
            }

            $sku = (string) $product->sku;

            if (! isset($byProduct[$sku])) {
                $rules = $this->seatRules($plan);

                $byProduct[$sku] = [
                    'id' => $sku,
                    'product' => $sku,
                    'name' => (string) $product->name,
                    'kind' => (string) $product->kind,
                    'currency' => (string) $plan->currency,
                    'approved' => true,
                    'purchasable' => true,
                    'seats' => $rules === null ? null : [
                        'min' => $rules['min'],
                        'max' => $rules['max'],
                        'default' => $rules['default'],
                        'discounts' => $rules['discounts'],
                    ],
                    'capabilities' => $product->capabilities
                        ->map(fn ($capability) => ['code' => $capability->code, 'coverage' => $capability->coverage])
                        ->values()
                        ->all(),
                    'cycles' => [],
                ];
            }

            /* تأییدنشده‌بودن یک چرخه، کل محصول را تأییدنشده نمی‌کند. */
            $byProduct[$sku]['approved'] = $byProduct[$sku]['approved'] && $plan->isApproved();
            $byProduct[$sku]['purchasable'] = $byProduct[$sku]['purchasable'] && $plan->isPurchasable();

            $byProduct[$sku]['cycles'][] = [
                'id' => $this->cycleIdForMonths((int) $plan->cycle_months),
                'months' => (int) $plan->cycle_months,
                'discountPercent' => (int) $plan->discount_percent,
                'priceMinor' => (int) $plan->price_minor,
                'approved' => $plan->isApproved(),
            ];
        }

        $catalog = array_values($byProduct);

        $allApproved = $catalog !== [] && ! in_array(false, array_column($catalog, 'approved'), true);

        return [
            'currency' => $this->currency(),
            'currencyLabel' => $this->currencyLabel(),
            'amountsConfirmed' => $allApproved,
            'checkout' => $this->checkoutState(),
            'cycles' => $this->cycles($plans->all()),
            'plans' => $catalog,
        ];
    }

    /**
     * وضعیت واقعی درگاه — بدون لو دادن Secret و بدون شکستن کاتالوگ عمومی.
     *
     * اگر درایور پیکربندی‌نشده باشد، کاتالوگ باید همچنان سرو شود (ماتریس قیمت
     * و قابلیت‌ها نمایشی است) ولی صادقانه بگوید خرید فعال نیست.
     *
     * @return array{enabled: bool, gateway: string, configured: bool}
     */
    private function checkoutState(): array
    {
        $driver = (string) config('commerce.gateway.driver');

        try {
            $gateway = $this->gateways->driver($driver);
            $configured = $gateway->isConfigured();
        } catch (\Throwable) {
            $configured = false;
        }

        return [
            'enabled' => $this->isCheckoutEnabled(),
            'gateway' => $driver,
            'configured' => $configured,
        ];
    }

    /**
     * چرخه‌های موجود — از خود طرح‌ها مشتق می‌شوند، نه از یک فهرست دستی.
     * برچسب و متن راهنمای هر چرخه کپی UI است و سمت فرانت می‌ماند.
     *
     * @param  list<Plan>  $plans
     * @return list<array<string, mixed>>
     */
    private function cycles(array $plans): array
    {
        $byMonths = [];

        foreach ($plans as $plan) {
            $months = (int) $plan->cycle_months;

            $byMonths[$months] ??= [
                'id' => $this->cycleIdForMonths($months),
                'months' => $months,
                'discountPercent' => (int) $plan->discount_percent,
            ];
        }

        ksort($byMonths);

        return array_values($byMonths);
    }
}
