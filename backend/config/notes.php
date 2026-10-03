<?php

/*
 * پیکربندی Notes و Review Notebook — فاز ۱۶.
 *
 * مرز دامنه: `user_notes` مالک یادداشت **شخصی** کاربر است و کاملاً از
 * `admin_notes` (پنل) جدا (§31). اشکال یادداشت از قرارداد واقعی فرانت‌اند
 * (src/services/notes/mockData.js) آمده — نه طراحی فرضی.
 */

return [

    'kinds' => ['text', 'checklist', 'qa', 'table'],

    /*
     * منبعی که یادداشت/مرور به آن وصل می‌شود — allowlist از SOURCE_TYPES فرانت.
     * هر مقدار دیگری ۴۲۲ می‌گیرد؛ polymorphic آزاد ممنوع (§34/§57).
     */
    'note_source_types' => ['lesson', 'question', 'article', 'wiki', 'book', 'other'],

    /* منبع‌های Review Item — از مصرف واقعی frontend (course-unit و manual و …). */
    'review_source_types' => ['manual', 'course-unit', 'lesson', 'question', 'article', 'wiki', 'flashcard', 'note', 'exam', 'other'],

    'activity_types' => ['learning', 'test', 'flashcard', 'note', 'other'],

    'colors' => ['#e26d6d', '#5b8cc7', '#77b787', '#e0b45c', '#937fcd', '#c2a48c'],
    'subjects' => [
        'physiology', 'anatomy', 'biochemistry', 'histology', 'neuroscience',
        'pathology', 'microbiology', 'pharmacology', 'immunology', 'general',
    ],

    'note' => [
        'title_max' => 240,
        'body_max' => 20000,
        'tags_max' => 24,
        'tag_max' => 40,
        'checklist_items_max' => 100,
        'checklist_item_max' => 240,
        'qa_pairs_max' => 100,
        'table_columns_max' => 12,
        'table_rows_max' => 100,
        'source_title_max' => 240,
        'source_id_max' => 64,
    ],

    /*
     * برنامهٔ مرور G5 — از قرارداد واقعی reviewNotebookService.js:
     *   G1=۱ روز، G2=۲ روز، G3=۴ روز، G4=۸ روز، G5=۱۶ روز.
     * منطق پیشروی در سرور است (ReviewItemService) تا کلاینت نتواند مرحله را جعل کند.
     */
    'review' => [
        'stages' => [1 => 1, 2 => 2, 3 => 4, 4 => 8, 5 => 16],
        'max_stage' => 5,
        'title_max' => 240,
        'description_max' => 2000,
        'subject_max' => 40,
        'source_id_max' => 64,
    ],

    'pagination' => [
        'per_page' => (int) env('NOTES_PER_PAGE', 100),
        'max_per_page' => (int) env('NOTES_MAX_PER_PAGE', 200),
    ],
];
