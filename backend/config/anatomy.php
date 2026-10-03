<?php

/*
 * پیکربندی Anatomy — فاز ۱۵.
 *
 * Anatomy فقط «نگاشت part_key → Media» است؛ مدل 3D هرگز داخل PostgreSQL
 * ذخیره نمی‌شود (§17). دسته‌ها از دادهٔ واقعی viewer آمده‌اند
 * (src/layout/dashboard/anatomy3d/data/anatomyCategories.js) — نه دستهٔ فرضی.
 */

return [

    /* دسته‌های واقعی viewer — allowlist سمت سرور. */
    'categories' => [
        'skin', 'bones', 'muscles', 'nerves', 'cns', 'arteries', 'veins',
        'respiratory', 'digestive', 'urinary', 'reproductive', 'ligaments',
        'lymph', 'fasciae', 'refs', 'other',
    ],

    'statuses' => ['draft', 'published', 'archived'],
    'part_key_max' => 160,
    'label_max' => 240,

    'pagination' => [
        'per_page' => (int) env('ANATOMY_PER_PAGE', 200),
        'max_per_page' => (int) env('ANATOMY_MAX_PER_PAGE', 500),
    ],
];
