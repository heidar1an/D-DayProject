<?php

/*
 * پیکربندی هویت (فاز ۲) — همهٔ اعداد و فهرست‌ها اینجا هستند، نه در کد.
 *
 * ⚠️ اعداد rate limit «پیش‌فرض پیشنهادی Blueprint» هستند، نه عدد اندازه‌گیری‌شدهٔ
 * سیستم. هیچ‌کدام hardcode نشده‌اند و همه از `.env` قابل تغییرند.
 */

return [

    /* ───────────────────────── رمز عبور ───────────────────────── */
    'passwords' => [
        // الگوریتم هش برای نوشتن‌های جدید (Laravel driver: argon2id | bcrypt)
        'driver' => env('IDENTITY_HASH_DRIVER', 'argon2id'),

        // آینهٔ `database/authPolicy.js` — نباید از legacy سخت‌گیرانه‌تر/آسان‌تر شود
        'min_length' => (int) env('IDENTITY_PASSWORD_MIN', 8),
        'max_length' => (int) env('IDENTITY_PASSWORD_MAX', 128),

        // ارتقای هش legacy پس از ورود موفق (BluePrint §12)
        'rehash_legacy_on_login' => (bool) env('IDENTITY_REHASH_LEGACY', true),

        // پارامترهای واقعی scrypt در Node = پیش‌فرض‌های `crypto.scryptSync`
        'legacy_scrypt' => [
            'n' => 16384,
            'r' => 8,
            'p' => 1,
            'key_length' => 64,
        ],
    ],

    /* ───────────────────────── سشن ───────────────────────── */
    'sessions' => [
        'ttl_minutes' => (int) env('IDENTITY_SESSION_TTL_MINUTES', 10080), // ۷ روز
        'cookie_max_age_minutes' => (int) env('IDENTITY_SESSION_COOKIE_MAX_AGE', 10080),
        'sliding' => (bool) env('IDENTITY_SESSION_SLIDING', true),
        // اگر کمتر از این نسبت از عمر سشن باقی مانده باشد، تمدید می‌شود
        'renew_when_remaining_below' => (float) env('IDENTITY_SESSION_RENEW_BELOW', 0.5),
        // `last_seen_at` حداکثر هر این‌قدر دقیقه یک‌بار نوشته می‌شود (ضد نوشتن سیل‌آسا)
        'touch_interval_minutes' => (int) env('IDENTITY_SESSION_TOUCH_MINUTES', 5),
    ],

    'cookies' => [
        'session' => env('IDENTITY_SESSION_COOKIE', 'tapesh_session'),
        'csrf' => env('IDENTITY_CSRF_COOKIE', 'tapesh_csrf'),
        'path' => env('IDENTITY_COOKIE_PATH', '/'),
        'domain' => env('IDENTITY_COOKIE_DOMAIN'),
        // در production همیشه true؛ فقط محیط محلی می‌تواند روی http کار کند
        'secure' => (bool) env('IDENTITY_COOKIE_SECURE', env('APP_ENV', 'production') !== 'local'),
        'same_site' => env('IDENTITY_COOKIE_SAME_SITE', 'strict'),
    ],

    'csrf' => [
        'header' => env('IDENTITY_CSRF_HEADER', 'X-CSRF-Token'),
    ],

    /*
     * بررسی same-origin روی همهٔ درخواست‌های نوشتاری.
     * پیش‌فرض روشن است (fail-closed). خاموش‌کردن آن فقط برای ابزارهای داخلی
     * مجاز است و باید آگاهانه باشد — هیچ تستی این را خاموش نمی‌کند.
     */
    'origin' => [
        'enforce' => (bool) env('IDENTITY_ENFORCE_ORIGIN', true),
    ],

    /* ─────────────────── rate limit (پیش‌فرض پیشنهادی) ─────────────────── */
    'rate_limits' => [
        'register' => ['max' => (int) env('RATE_REGISTER_MAX', 5), 'decay_minutes' => (int) env('RATE_REGISTER_DECAY', 60)],
        'login' => ['max' => (int) env('RATE_LOGIN_MAX', 10), 'decay_minutes' => (int) env('RATE_LOGIN_DECAY', 15)],
        'logout' => ['max' => (int) env('RATE_LOGOUT_MAX', 30), 'decay_minutes' => (int) env('RATE_LOGOUT_DECAY', 1)],
        'me' => ['max' => (int) env('RATE_ME_MAX', 120), 'decay_minutes' => (int) env('RATE_ME_DECAY', 1)],
        'profile' => ['max' => (int) env('RATE_PROFILE_MAX', 20), 'decay_minutes' => (int) env('RATE_PROFILE_DECAY', 1)],
        'universities' => ['max' => (int) env('RATE_UNIVERSITIES_MAX', 120), 'decay_minutes' => (int) env('RATE_UNIVERSITIES_DECAY', 1)],
    ],

    /* ───────────────────────── پروفایل ───────────────────────── */
    'profile' => [
        'name_max' => 60,

        'username' => [
            'min' => 3,
            'max' => 32,
            'pattern' => '/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/',
        ],

        'term' => ['min' => 1, 'max' => 20],

        // مقادیر واقعی فرم‌های پروژه (`EditProfile.jsx`) — عمداً فارسی و بدون
        // ترجمه: تغییرشان یعنی تغییر قرارداد با دادهٔ موجود کاربران.
        'grades' => [
            'دوره علوم پایه',
            'فیزیوپاتولوژی',
            'استاژ (کارآمینی)',
            'اینترنی',
            'دستیاری',
            'سایر',
        ],
        'genders' => ['مرد', 'زن'],

        'birth_date_jalali' => ['pattern' => '/^\d{4}\/\d{1,2}\/\d{1,2}$/'],
        'avatar' => ['pattern' => '/^(0[1-9]|[1-2]\d|3[0-5])$/'],

        // آینهٔ `database/models/enums.js`
        'motivations' => [
            'learning', 'income', 'no-goal', 'friends',
            'helping-people', 'personal-interest', 'family-job', 'experience',
        ],
        'referrals' => [
            'telegram', 'internet', 'friends', 'university',
            'bale', 'instagram', 'rubika', 'artificial-intelligence',
        ],
        'max_list_items' => 8,
    ],

    /* ───────────────────── دانشگاه‌ها (endpoint عمومی) ───────────────────── */
    'universities' => [
        'per_page' => (int) env('UNIVERSITIES_PER_PAGE', 25),
        'max_per_page' => 100,
        'cache_seconds' => (int) env('UNIVERSITIES_CACHE_SECONDS', 300),
    ],

    /* ───────────────────── گوگل (فاز ۲: غیرفعال) ───────────────────── */
    'google' => [
        // هیچ credential واقعی در مخزن وجود ندارد؛ اگر هر دو مقدار تهی باشند
        // provider «پیکربندی‌نشده» است و هیچ ورود ساختگی‌ای انجام نمی‌شود.
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect_uri' => env('GOOGLE_REDIRECT_URI'),
    ],
];
