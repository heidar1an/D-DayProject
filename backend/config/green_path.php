<?php

/*
 * پیکربندی مسیر سبز (فاز ۱۳).
 *
 * همهٔ اعداد سقف/ظرفیت محافظتی‌اند و از `.env` قابل تغییرند. هیچ عددی از کلاینت
 * خوانده نمی‌شود؛ «امروز» همیشه با ساعت سرور (timezone پروژه) تعیین می‌شود.
 */

return [

    'goals' => [
        /*
         * فهرست بستهٔ goal_key — با کلیدهای واقعی Frontend (`GOAL_PROFILES` در
         * `src/services/greenPath/greenPathConfig.js`) هم‌خوان است. کلید تازه
         * یعنی migration (ستون CHECK دارد) + به‌روزرسانی همین فهرست.
         */
        'keys' => ['semester-excellence', 'basic-sciences'],

        'default' => 'semester-excellence',
    ],

    'planning' => [
        /* افق برنامه (هفته) وقتی ترم مشخصی وجود ندارد. */
        'horizon_weeks' => (int) env('GREEN_PATH_HORIZON_WEEKS', 12),

        /* ظرفیت مطالعهٔ پیش‌فرض روزانه (دقیقه) برای پخش‌کردن قدم‌ها. */
        'daily_minutes' => (int) env('GREEN_PATH_DAILY_MINUTES', 180),

        /* برآورد دقیقه برای یک قدم درسی — ظرفیت تخمینی، نه benchmark. */
        'minutes_per_lesson_step' => (int) env('GREEN_PATH_MINUTES_PER_LESSON', 45),

        /* سقف قدم‌های یک مسیر — برنامهٔ بی‌نهایت یعنی UI بی‌نهایت. */
        'max_steps' => (int) env('GREEN_PATH_MAX_STEPS', 400),

        /*
         * پنجرهٔ باز: قدم پیش‌رو `recommended` و این تعداد قدم بعدی `available`
         * می‌مانند؛ بقیه `locked`. برنامهٔ درِباز، مسیر نیست.
         */
        'unlock_window' => (int) env('GREEN_PATH_UNLOCK_WINDOW', 5),

        /* قدم‌های آزمونی نزدیک موعد، مستقل از توالی، available می‌مانند (روز). */
        'exam_available_days' => (int) env('GREEN_PATH_EXAM_AVAILABLE_DAYS', 3),

        /* سقف بازهٔ تقویم (روز) — جلوی query بی‌کران را می‌گیرد. */
        'calendar_max_days' => (int) env('GREEN_PATH_CALENDAR_MAX_DAYS', 60),
    ],

    'cache' => [
        /* کش کوتاه‌مدت per-user برای roadmap — کلید همیشه userId دارد و بین
         * کاربران share نمی‌شود. TTL تصادفی نیست: کوتاه‌تر از گردش محتواست و
         * هر mutation مرتبط، دستی invalidate می‌شود. */
        'roadmap_ttl_seconds' => (int) env('GREEN_PATH_ROADMAP_CACHE_TTL', 120),
    ],

    'rate_limits' => [
        'greenpath_read' => ['max' => (int) env('RATE_GREENPATH_READ_MAX', 120), 'decay_minutes' => (int) env('RATE_GREENPATH_READ_DECAY', 1)],
        'greenpath_write' => ['max' => (int) env('RATE_GREENPATH_WRITE_MAX', 60), 'decay_minutes' => (int) env('RATE_GREENPATH_WRITE_DECAY', 1)],
    ],

];
