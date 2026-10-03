<?php

/*
 * پیکربندی Analytics (فاز ۸).
 *
 * اصل معماری: Analytics یک دامنهٔ **خواندنی/تجمیعی** است، نه منبع حقیقت تازه.
 * هیچ جدول مشتق‌شده‌ای اینجا نوشته نمی‌شود؛ همه‌چیز از جداول دامنه محاسبه و
 * کوتاه‌مدت cache می‌شود.
 */

return [

    /*
     * انواع رویداد — **typed و بسته**. مقدار تازه فقط با تولیدکنندهٔ واقعی
     * (Domain Event موجود) اضافه شود. در این فاز هیچ endpointی برای ingestion
     * رویداد کلاینت وجود ندارد: رویدادهای حساس (`exam_finished`,
     * `lesson_completed`) فقط سمت سرور تولید می‌شوند.
     */
    'event_types' => [
        'lesson_completed',
        'question_answered',
        'study_session_recorded',
        'exam_started',
        'exam_finished',
    ],

    /* سقف اندازهٔ properties — JSONB نباید سطل اطلاعات نامحدود شود. */
    'max_properties_bytes' => (int) env('ANALYTICS_MAX_PROPERTIES_BYTES', 2048),

    /*
     * کلیدهای ممنوع در `properties` (PII/secret). نوشتن با این کلیدها رد می‌شود.
     * مقایسه case-insensitive و بر پایهٔ «شامل بودن» است تا
     * `access_token`/`sessionId`/`password_hash` هم گرفته شود.
     */
    'forbidden_property_keys' => [
        'password', 'passwd', 'token', 'secret', 'authorization', 'cookie',
        'session', 'sessionid', 'session_id', 'apikey', 'api_key', 'private_key',
        'card', 'cvv', 'iban', 'national_id', 'nationalcode', 'phone', 'mobile',
        'email', 'address', 'ip',
    ],

    /*
     * Retention رویدادها — configuration-based، نه hardcode.
     * پاک‌سازی هرگز به `exam_results`/`learning_progress`/`question_attempts`
     * دست نمی‌زند؛ فقط `analytics_events`.
     */
    'retention_days' => (int) env('ANALYTICS_RETENTION_DAYS', 400),

    /*
     * Cache کوتاه‌مدت per-user. کلید همیشه `userId` و نسخهٔ invalidation را
     * در خود دارد؛ cache مشترک بین کاربران ممنوع است.
     */
    'cache' => [
        'enabled' => (bool) env('ANALYTICS_CACHE_ENABLED', true),
        'ttl_seconds' => (int) env('ANALYTICS_CACHE_TTL', 60),
        'prefix' => env('ANALYTICS_CACHE_PREFIX', 'analytics'),
    ],

    'limits' => [
        'max_recent_activity' => (int) env('ANALYTICS_MAX_RECENT', 20),
        'max_recent_results' => (int) env('ANALYTICS_MAX_RECENT_RESULTS', 10),
        'max_trend_buckets' => (int) env('ANALYTICS_MAX_TREND_BUCKETS', 90),
        'max_topic_rows' => (int) env('ANALYTICS_MAX_TOPIC_ROWS', 200),
    ],

    /*
     * دانه‌بندی بازهٔ زمانی. Timezone از پروفایل کاربر/`app.timezone` می‌آید و
     * **hardcode نیست**؛ دیتابیس همیشه UTC می‌ماند و تبدیل در لایهٔ تجمیع
     * انجام می‌شود.
     */
    'buckets' => ['daily', 'weekly', 'monthly'],

    'rate_limits' => [
        'read' => ['max' => (int) env('RATE_ANALYTICS_READ_MAX', 120), 'decay_minutes' => (int) env('RATE_ANALYTICS_READ_DECAY', 1)],
    ],

];
