<?php

/*
 * پیکربندی ویکی — فاز ۱۰.
 *
 * ⚠️ همهٔ اعداد «سقف محافظتی/پیش‌فرض پیشنهادی» هستند، نه benchmark اندازه‌گیری‌شده.
 *
 * مرز دامنه: Wiki مالک محتوای دانشنامه‌ای است (Category → Article → Relation →
 * Bookmark). **Knowledge Graph در این فاز ساخته نمی‌شود**؛ ویکی فقط طوری طراحی
 * می‌شود که فاز ۱۱ بتواند با شناسه به آن وصل شود.
 */

return [

    'articles' => [
        'slug_max' => (int) env('WIKI_SLUG_MAX', 160),
        'title_max' => (int) env('WIKI_TITLE_MAX', 240),
        'summary_max' => (int) env('WIKI_SUMMARY_MAX', 600),
        'body_max' => (int) env('WIKI_BODY_MAX', 200000),
        'statuses' => ['draft', 'published', 'archived'],
        'difficulties' => ['basic', 'intermediate', 'advanced'],
        /* انواع محتوا — از `CONTENT_TYPES` فرانت‌اند استخراج شده‌اند. */
        'content_types' => ['concept', 'disease', 'drug', 'anatomy', 'pathway', 'labTest', 'microorganism', 'sign'],
        'max_key_facts' => (int) env('WIKI_MAX_KEY_FACTS', 12),
        'max_keywords' => (int) env('WIKI_MAX_KEYWORDS', 40),
    ],

    'categories' => [
        'slug_max' => (int) env('WIKI_CATEGORY_SLUG_MAX', 120),
        'name_max' => (int) env('WIKI_CATEGORY_NAME_MAX', 160),
        'description_max' => (int) env('WIKI_CATEGORY_DESCRIPTION_MAX', 600),
        'statuses' => ['draft', 'published', 'archived'],
        /*
         * عمق مجاز درخت دسته‌بندی. بدون سقف، «cycle detection» تنها محافظ است؛
         * با سقف، درخت پوچ‌وغیرقابل‌مرور هم رد می‌شود.
         */
        'max_depth' => (int) env('WIKI_CATEGORY_MAX_DEPTH', 5),
    ],

    /*
     * نوع رابطهٔ گراف دانش — **allowlist**.
     *
     * مقادیر عیناً از `RELATIONS` در `src/services/wiki/mockData.js` آمده‌اند.
     * نوع تازه فقط با مصرف‌کنندهٔ واقعی اضافه می‌شود، نه «برای آینده».
     */
    'relations' => [
        'kinds' => [
            'related_to',
            'regulates',
            'regulated_by',
            'part_of',
            'contains',
            'produces',
            'causes',
            'caused_by',
            'treated_by',
            'measured_by',
            'measures',
        ],
        'max_per_article' => (int) env('WIKI_MAX_RELATIONS_PER_ARTICLE', 50),
    ],

    'search' => [
        'min_query_length' => (int) env('WIKI_SEARCH_MIN_LENGTH', 2),
        'max_query_length' => (int) env('WIKI_SEARCH_MAX_LENGTH', 120),
        'suggest_limit_default' => (int) env('WIKI_SUGGEST_LIMIT', 8),
        'suggest_limit_max' => (int) env('WIKI_SUGGEST_LIMIT_MAX', 20),
        'suggest_min_query_length' => (int) env('WIKI_SUGGEST_MIN_LENGTH', 2),
        /*
         * جست‌وجوی اولیه PostgreSQL است (ILIKE محدود + نرمال‌سازی فارسی).
         * موتور تخصصی در این فاز ساخته نمی‌شود؛ اگر روزی FTS لازم شد، تنها
         * نقطهٔ تغییر `WikiSearchService` است.
         */
        'driver' => env('WIKI_SEARCH_DRIVER', 'sql'),
    ],

    'pagination' => [
        'per_page' => (int) env('WIKI_PER_PAGE', 20),
        'max_per_page' => (int) env('WIKI_MAX_PER_PAGE', 50),
    ],

    'sanitize' => [
        'enabled' => (bool) env('WIKI_SANITIZE', true),
        /* طول بدنهٔ ورودی پیش از فیلتر — محافظت از CPU در برابر payload غول‌آسا. */
        'max_input_length' => (int) env('WIKI_SANITIZE_MAX_INPUT', 400000),
    ],

    'rate_limits' => [
        'read' => ['max' => (int) env('RATE_WIKI_READ_MAX', 240), 'decay_minutes' => (int) env('RATE_WIKI_READ_DECAY', 1)],
        'search' => ['max' => (int) env('RATE_WIKI_SEARCH_MAX', 120), 'decay_minutes' => (int) env('RATE_WIKI_SEARCH_DECAY', 1)],
        'bookmark' => ['max' => (int) env('RATE_WIKI_BOOKMARK_MAX', 120), 'decay_minutes' => (int) env('RATE_WIKI_BOOKMARK_DECAY', 1)],
        'admin' => ['max' => (int) env('RATE_ADMIN_WIKI_MAX', 180), 'decay_minutes' => (int) env('RATE_ADMIN_WIKI_DECAY', 1)],
    ],

    /*
     * کش محتوای عمومی منتشرشده. کلید شامل scope است و هیچ دادهٔ کاربر در آن
     * نمی‌رود (فاز ۱۰ §49).
     */
    'cache' => [
        'published_ttl_seconds' => (int) env('WIKI_PUBLISHED_TTL', 60),
    ],

];
