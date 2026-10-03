<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Product;
use App\Models\ProductCapability;
use Illuminate\Database\Seeder;

/**
 * ساختار کاتالوگ تجاری — فاز ۱۸.
 *
 * ⚠️ سه قاعدهٔ سخت که این seeder عمداً رعایت می‌کند:
 *
 *   ۱. **هیچ قیمتی جعل نمی‌شود.** مبلغ ماهانه از `commerce.seed_prices`
 *      (یعنی `.env`) خوانده می‌شود. اگر تنظیم نشده باشد، طرح ساخته **نمی‌شود**؛
 *      یک طرح با قیمت صفر یا عدد نمونه، بدترین حالت است چون «قابل خرید» به
 *      نظر می‌رسد.
 *   ۲. **هیچ طرحی تأیید نمی‌شود.** `approved_at` عمداً NULL می‌ماند. تأیید قیمت
 *      یک اقدام انسانی است، نه یک اثر جانبی seed. تا آن لحظه خرید ۴۰۹ می‌گیرد
 *      و `/pricing/plans` صادقانه `amountsConfirmed: false` می‌دهد (§26/§68).
 *   ۳. **قابلیت‌ها از مدل واقعی محصول.** فهرست زیر آینهٔ
 *      `services/pricing/pricingService.js` (`CAPABILITY_ROWS[].coverage`) است؛
 *      جایی که پوشش `none` است، **ردیفی ساخته نمی‌شود** — چون «قابلیت ندارد»
 *      با «قابلیت با پوشش صفر» یکی نیست و ردیف `none` فقط فهرست دروازه‌بانی را
 *      آلوده می‌کند.
 *
 * اجرا: `php artisan db:seed --class=CommerceCatalogSeeder`
 */
class CommerceCatalogSeeder extends Seeder
{
    /** sku → نام نمایشی محصول. */
    private const PRODUCTS = [
        'regular' => 'اشتراک عادی',
        'pro' => 'اشتراک پرو',
        'group' => 'اشتراک گروهی',
    ];

    /**
     * قابلیت‌ها به‌ازای هر محصول — آینهٔ `coverage` در UI.
     *
     * @var array<string, array<string, string>>
     */
    private const CAPABILITIES = [
        'lessons' => ['regular' => 'full', 'pro' => 'full', 'group' => 'full'],
        'bank' => ['regular' => 'partial', 'pro' => 'full', 'group' => 'full'],
        'builder' => ['regular' => 'partial', 'pro' => 'full', 'group' => 'full'],
        'intl' => ['pro' => 'full', 'group' => 'full'],
        'review' => ['regular' => 'partial', 'pro' => 'full', 'group' => 'full'],
        'analytics' => ['pro' => 'full', 'group' => 'full'],
        'ai' => ['regular' => 'partial', 'pro' => 'full', 'group' => 'full'],
        'wiki' => ['regular' => 'full', 'pro' => 'full', 'group' => 'full'],
        'league' => ['regular' => 'full', 'pro' => 'full', 'group' => 'full'],
        'support' => ['pro' => 'full', 'group' => 'partial'],
    ];

    public function run(): void
    {
        $prices = (array) config('commerce.seed_prices');
        $currency = (string) config('commerce.currency.code');
        $cycles = array_keys((array) config('commerce.cycles'));

        $discounts = [1 => 0, 3 => 10, 12 => 20];

        $products = [];

        foreach (self::PRODUCTS as $sku => $name) {
            $products[$sku] = Product::query()->updateOrCreate(
                ['sku' => $sku],
                [
                    'kind' => Product::KIND_SUBSCRIPTION,
                    'name' => $name,
                    'status' => Product::STATUS_ACTIVE,
                ],
            );
        }

        foreach (self::CAPABILITIES as $code => $coverageBySku) {
            foreach ($coverageBySku as $sku => $coverage) {
                if (! isset($products[$sku])) {
                    continue;
                }

                ProductCapability::query()->updateOrCreate(
                    ['product_id' => $products[$sku]->getKey(), 'code' => $code],
                    ['coverage' => $coverage],
                );
            }
        }

        foreach (self::PRODUCTS as $sku => $name) {
            $monthly = $prices[$sku] ?? null;

            if ($monthly === null || ! is_numeric($monthly) || (int) $monthly <= 0) {
                /* قیمت تأییدنشده ⇒ طرح ساخته نمی‌شود. پیام صریح، نه سکوت. */
                $this->command?->warn("Commerce: price for [{$sku}] is not configured — plan skipped.");

                continue;
            }

            foreach ($cycles as $months) {
                $months = (int) $months;

                Plan::query()->updateOrCreate(
                    ['code' => $sku.'-'.($this->cycleId($months) ?? $months.'m')],
                    [
                        'product_id' => $products[$sku]->getKey(),
                        'price_minor' => (int) $monthly,
                        'currency' => $currency,
                        'cycle_months' => $months,
                        'discount_percent' => $discounts[$months] ?? 0,
                        /* نردبان صندلی فقط روی پلن گروهی. */
                        'pricing_rules' => $sku === 'group'
                            ? ['seats' => (array) config('commerce.group_seats')]
                            : null,
                        /* ⚠️ عمداً NULL: تأیید قیمت اقدامی انسانی است. */
                        'approved_at' => null,
                        'status' => Plan::STATUS_ACTIVE,
                    ],
                );
            }
        }
    }

    private function cycleId(int $months): ?string
    {
        $id = ((array) config('commerce.cycles'))[$months] ?? null;

        return is_string($id) ? $id : null;
    }
}
