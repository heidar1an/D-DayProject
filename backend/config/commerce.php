<?php

/*
 * پیکربندی Commerce (فاز ۱۸).
 *
 * ⚠️ دو کلید امنیتی که وضعیت واقعی سیستم را می‌گویند:
 *
 *   `checkout.enabled`   — آیا خرید واقعی فعال است؟ پیش‌فرض **false**.
 *                          تا وقتی قیمت واقعی تأیید و درگاه واقعی وصل نشده،
 *                          هیچ سفارش/پرداختی ساخته نمی‌شود (Prompt §17/§26).
 *   `entitlements.enforce` — آیا دروازه‌بانی entitlement فعال است؟ پیش‌فرض
 *                          **false**: تا نبودِ زیرساخت پرداخت، محتوا مثل امروز
 *                          باز است و این رفتار صریح و مستند است (Prompt §11).
 *                          با true شدن، فقط قابلیت‌هایی که در
 *                          `product_capabilities` ثبت شده‌اند دروازه‌بانی
 *                          می‌شوند؛ قابلیت‌های عمومی مثل `content.lesson_page`
 *                          بدون دروازه می‌مانند و قفل نمی‌شوند.
 *
 * هیچ Secret در این فایل نیست؛ همه از `.env`/Secret Manager می‌آیند. اگر Secret
 * درگاه تنظیم نشده باشد، آداپتور **503** می‌دهد و هرگز به مقدار پیش‌فرض
 * حدس‌زدنی برنمی‌گردد (Prompt §38).
 */

return [

    /*
     * واحد پول. `minor_units` = تعداد رقم اعشار واحد پول در محاسبات.
     * تومان/ریال رقم اعشار ندارند، پس `price_minor` عیناً همان تومان است و
     * هیچ ضرب/تقسیم اعشاری‌ای در مسیر پول انجام نمی‌شود.
     */
    'currency' => [
        'code' => env('COMMERCE_CURRENCY', 'IRT'),
        'label' => env('COMMERCE_CURRENCY_LABEL', 'تومان'),
        'minor_units' => (int) env('COMMERCE_CURRENCY_MINOR_UNITS', 0),
        /* whitelist — کد بیرون این فهرست در هیچ مسیری پذیرفته نمی‌شود (§69). */
        'whitelist' => ['IRT', 'IRR'],
    ],

    'checkout' => [
        'enabled' => filter_var(env('COMMERCE_CHECKOUT_ENABLED', false), FILTER_VALIDATE_BOOL),
    ],

    'entitlements' => [
        'enforce' => filter_var(env('COMMERCE_ENFORCE_ENTITLEMENTS', false), FILTER_VALIDATE_BOOL),
    ],

    'orders' => [
        /* پنجرهٔ پرداخت — بعد از آن سفارش `expired` است و تأیید رد می‌شود. */
        'ttl_minutes' => (int) env('COMMERCE_ORDER_TTL_MINUTES', 30),
        /* سقف صندلی در یک سفارش — از UI واقعی (`seats.max = 3`) نمی‌گذرد. */
        'max_seats' => (int) env('COMMERCE_MAX_SEATS', 3),
        /* سقف سفارش باز هم‌زمان هر کاربر — محافظت از سطل زبالهٔ سفارش. */
        'max_open_per_user' => (int) env('COMMERCE_MAX_OPEN_ORDERS', 5),
    ],

    /*
     * چرخهٔ پرداخت: ماه → شناسهٔ واقعی UI (`services/pricing/pricingService.js`:
     * `BILLING_CYCLES`). این نگاشت تنها منبع تبدیل است؛ درصد تخفیف هر چرخه در
     * `plans.discount_percent` می‌نشیند و اینجا تکرار نمی‌شود.
     */
    'cycles' => [
        1 => 'monthly',
        3 => 'quarterly',
        12 => 'yearly',
    ],

    /*
     * آداپتور درگاه.
     *
     * `sandbox` تنها درایور موجود است: پرداخت واقعی **نیست**، بلکه یک درگاه
     * شبیه‌سازی‌شده با امضای HMAC واقعی است. چرا HMAC و نه یک «موفق» ثابت:
     * بدون بررسی رمزنگاری‌شده، «تطبیق مبلغ» و «جعل Webhook» قابل تست واقعی
     * نبودند و ادعای امنیتی توخالی می‌شد.
     */
    'gateway' => [
        'driver' => env('PAYMENT_GATEWAY', 'sandbox'),

        'sandbox' => [
            /* خالی ⇒ آداپتور 503 می‌دهد. هیچ Secret پیش‌فرضی در کد نیست. */
            'secret' => env('PAYMENT_SANDBOX_SECRET'),
            'checkout_url' => env('PAYMENT_SANDBOX_CHECKOUT_URL', 'https://sandbox.payments.invalid/pay'),
        ],

        /*
         * درگاه واقعی — **غیرفعال** تا زمانی که قیمت واقعی تأیید و merchant
         * واقعی تنظیم شود. وجود این کلید یعنی «محل اتصال مشخص است»، نه «وصل
         * شده». تا `enabled=true` نشود هیچ مسیری به آن نمی‌رود.
         */
        'zarinpal' => [
            'enabled' => filter_var(env('ZARINPAL_ENABLED', false), FILTER_VALIDATE_BOOL),
            'merchant_id' => env('ZARINPAL_MERCHANT_ID'),
            'callback_url' => env('ZARINPAL_CALLBACK_URL'),
        ],
    ],

    /*
     * قیمت ماهانهٔ هر محصول (minor) — **ورودی seed، نه منبع حقیقت**.
     * منبع حقیقت `plans.price_minor` است. این کلید فقط برای seed اولیه است و
     * عمداً پیش‌فرض ندارد: اگر تنظیم نشود، طرح با قیمت ساخته نمی‌شود و
     * `approved_at` هم ست نمی‌شود ⇒ قابل خرید نیست.
     */
    'seed_prices' => [
        'regular' => env('PRICE_REGULAR_MONTHLY'),
        'pro' => env('PRICE_PRO_MONTHLY'),
        'group' => env('PRICE_GROUP_MONTHLY'),
    ],

    /* نردبان صندلی پلن گروهی — از UI واقعی (`plan.seats.discounts`). */
    'group_seats' => [
        'min' => 2,
        'max' => 3,
        'default' => 2,
        'discounts' => [2 => 15, 3 => 30],
    ],

    'rate_limits' => [
        'plans' => ['max' => (int) env('RATE_PRICING_PLANS_MAX', 120), 'decay_minutes' => (int) env('RATE_PRICING_PLANS_DECAY', 1)],
        'quote' => ['max' => (int) env('RATE_PRICING_QUOTE_MAX', 30), 'decay_minutes' => (int) env('RATE_PRICING_QUOTE_DECAY', 1)],
        'orders' => ['max' => (int) env('RATE_ORDERS_MAX', 20), 'decay_minutes' => (int) env('RATE_ORDERS_DECAY', 1)],
        'payments' => ['max' => (int) env('RATE_PAYMENTS_MAX', 30), 'decay_minutes' => (int) env('RATE_PAYMENTS_DECAY', 1)],
        'me' => ['max' => (int) env('RATE_COMMERCE_ME_MAX', 120), 'decay_minutes' => (int) env('RATE_COMMERCE_ME_DECAY', 1)],
        /*
         * Webhook: سقف سخاوتمندانه و بر اساس provider+IP.
         * چرا سخاوتمندانه: retry قانونی درگاه نباید رد شود. محافظت واقعی
         * امضای رمزنگاری‌شده است، نه rate limit (Prompt §63/§64).
         */
        'webhook' => ['max' => (int) env('RATE_PAYMENT_WEBHOOK_MAX', 300), 'decay_minutes' => (int) env('RATE_PAYMENT_WEBHOOK_DECAY', 1)],
    ],

];
