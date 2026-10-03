<?php

/*
 * پیکربندی References — فاز ۱۵.
 *
 * مرز دامنه: Reference مالک «محتوای مرجع (sections) + نگاشت asset» است (§54).
 * فایل تصویر/پیوست روی Media می‌نشیند و اینجا فقط media_id نگه داشته می‌شود.
 */

return [

    'slug_max' => (int) env('REFERENCES_SLUG_MAX', 160),
    'title_max' => (int) env('REFERENCES_TITLE_MAX', 240),
    'description_max' => (int) env('REFERENCES_DESCRIPTION_MAX', 1000),
    'statuses' => ['draft', 'published', 'archived'],

    /* سقف ساختاری محتوا — جلوی JSON عظیم را می‌گیرد (§13/§17). */
    'max_sections' => (int) env('REFERENCES_MAX_SECTIONS', 40),
    'max_topics_per_section' => (int) env('REFERENCES_MAX_TOPICS', 60),
    'topic_content_max' => (int) env('REFERENCES_TOPIC_CONTENT_MAX', 100000),

    /* کلید asset (مثل کلید تصویر در بلوک‌های viewer) — رشتهٔ کوتاه slug-مانند. */
    'asset_key_max' => 120,

    'pagination' => [
        'per_page' => (int) env('REFERENCES_PER_PAGE', 24),
        'max_per_page' => (int) env('REFERENCES_MAX_PER_PAGE', 100),
    ],
];
