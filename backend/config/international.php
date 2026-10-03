<?php

/*
 * پیکربندی کاتالوگ بین‌الملل (فاز ۱۷).
 *
 * اعداد صفحه‌بندی و rate limit «پیش‌فرض پیشنهادی» هستند، نه benchmark
 * اندازه‌گیری‌شده. هیچ‌کدام hardcode نیستند و از `.env` قابل تغییرند.
 *
 * `categories` و `provider_kinds` از دادهٔ واقعی UI استخراج شده‌اند
 * (`services/international/intlCatalog.js`: `INTL_COURSE_CATEGORIES` و
 * `INTL_PROVIDER_KINDS`). این‌ها allowlist اعتبارسنجی‌اند، نه فهرست نمایشی.
 */

return [

    'pagination' => [
        'per_page' => (int) env('INTL_PER_PAGE', 12),
        'max_per_page' => (int) env('INTL_MAX_PER_PAGE', 50),
    ],

    /* دسته‌های واقعی دوره — هر مقدار بیرون این فهرست رد می‌شود. */
    'categories' => ['medicine', 'science', 'skills', 'media'],

    /* نوع ناشر — آینهٔ `INTL_PROVIDER_KINDS`. */
    'provider_kinds' => ['university', 'media', 'journal', 'organization'],

    'rate_limits' => [
        'read' => ['max' => (int) env('RATE_INTL_READ_MAX', 120), 'decay_minutes' => (int) env('RATE_INTL_READ_DECAY', 1)],
        'write' => ['max' => (int) env('RATE_INTL_WRITE_MAX', 60), 'decay_minutes' => (int) env('RATE_INTL_WRITE_DECAY', 1)],
    ],

];
