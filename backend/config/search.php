<?php

/*
 * Search — فاز ۱۹.
 *
 * مرز: `search_documents` **projection بازسازپذیر** است، نه منبع حقیقت (§20/§32).
 * منبع حقیقت همان جدول دامنه است و هر کوئری عمومی یک بار دیگر `status` دامنه را
 * چک می‌کند تا ایندکس کهنه هرگز پیش‌نویس را لو ندهد (§34).
 *
 * موتور: PostgreSQL Full Text Search. Elasticsearch/Meilisearch **اضافه نشد**
 * چون اندازه‌گیری‌ای نیازش را ثابت نکرده (§31/§43).
 */

return [

    'table' => 'search_documents',

    /*
     * دامنه‌های ایندکس‌شدنی — هرکدام باید **مصرف‌کنندهٔ واقعی** داشته باشد (§36).
     * کلید = `entity_type` ذخیره‌شده در ایندکس.
     *
     * `label` = برچسب فارسی نتیجه؛ `priority` = وزن deterministic در رتبه‌بندی
     * (§38)؛ `permission` = سیاست دسترسی دامنه که در کوئری رعایت می‌شود.
     */
    'domains' => [
        'course' => [
            'label' => 'درس',
            'priority' => 30,
            'permission' => 'public',
        ],
        'lesson' => [
            'label' => 'درسنامه',
            'priority' => 25,
            'permission' => 'public',
        ],
        'wiki_article' => [
            'label' => 'ویکی',
            'priority' => 20,
            'permission' => 'public',
        ],
        'article' => [
            'label' => 'مقاله',
            'priority' => 15,
            'permission' => 'public',
        ],
        'reference' => [
            'label' => 'مرجع',
            'priority' => 10,
            'permission' => 'public',
        ],
        'knowledge_node' => [
            'label' => 'گراف دانش',
            'priority' => 5,
            'permission' => 'public',
        ],
    ],

    'pagination' => [
        'per_page' => (int) env('SEARCH_PER_PAGE', 15),
        'max_per_page' => (int) env('SEARCH_MAX_PER_PAGE', 40),
    ],

    'query' => [
        'min_length' => (int) env('SEARCH_MIN_LENGTH', 2),
        'max_length' => (int) env('SEARCH_MAX_LENGTH', 120),
        /* سقف نامزدهای FTS پیش از فیلتر دسترسی — «unbounded query» ممنوع (§42). */
        'max_candidates' => (int) env('SEARCH_MAX_CANDIDATES', 200),
    ],

    /* مرتب‌سازی allowlist (§37). */
    'sorts' => ['relevance', 'latest'],

    'indexing' => [
        'queue' => env('SEARCH_QUEUE', 'search'),
        'tries' => (int) env('SEARCH_INDEX_TRIES', 3),
        'backoff' => [15, 60, 300],
        'timeout' => (int) env('SEARCH_INDEX_TIMEOUT', 30),
        'batch' => (int) env('SEARCH_INDEX_BATCH', 200),
    ],

    /* متن ایندکس‌شده — سقف بدنه تا یک رکورد حجیم ایندکس را نترکاند. */
    'limits' => [
        'title_max' => (int) env('SEARCH_TITLE_MAX', 300),
        'body_max' => (int) env('SEARCH_BODY_MAX', 20000),
    ],

    'cache' => [
        /* کش کوتاه‌عمر نتیجهٔ عمومی — فقط محتوای `published`، هیچ دادهٔ محرمانه (§13). */
        'enabled' => (bool) env('SEARCH_CACHE_ENABLED', true),
        'ttl_seconds' => (int) env('SEARCH_CACHE_TTL', 60),
    ],

];
