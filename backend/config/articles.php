<?php

/*
 * پیکربندی Articles — فاز ۱۶.
 *
 * مرز دامنه: Article این فاز `wiki_articles` نیست (§56) — دو Domain مستقل‌اند
 * و هیچ‌کدام جدول دیگری را mutate نمی‌کند. lifecycle همان convention محتوایی
 * پروژه است: draft/published/archived.
 */

return [

    'slug_max' => (int) env('ARTICLES_SLUG_MAX', 160),
    'title_max' => (int) env('ARTICLES_TITLE_MAX', 240),
    'summary_max' => (int) env('ARTICLES_SUMMARY_MAX', 600),
    'body_max' => (int) env('ARTICLES_BODY_MAX', 200000),
    'statuses' => ['draft', 'published', 'archived'],

    /* مرتب‌سازی فهرست عمومی — allowlist؛ کلاینت ستون دلخواه نمی‌فرستد (§27). */
    'sorts' => ['latest'],

    'categories' => [
        'slug_max' => (int) env('ARTICLE_CATEGORY_SLUG_MAX', 120),
        'name_max' => (int) env('ARTICLE_CATEGORY_NAME_MAX', 160),
        'statuses' => ['draft', 'published', 'archived'],
    ],

    'pagination' => [
        'per_page' => (int) env('ARTICLES_PER_PAGE', 12),
        'max_per_page' => (int) env('ARTICLES_MAX_PER_PAGE', 48),
    ],
];
