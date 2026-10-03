<?php

/*
 * پیکربندی Feedback — فاز ۱۶.
 *
 * مرز دامنه: Feedback مالک «گزارش کاربر + پاسخ مدیر» است (§54). Privacy:
 * body هرگز در Log نمی‌آید، در کش عمومی نمی‌نشیند و event تحلیلی نمی‌سازد (§50).
 *
 * مقدارهای `source` از قرارداد واقعی فرانت (FEEDBACK_SOURCES) آمده — allowlist
 * سمت سرور؛ هر مقدار دیگری ۴۲۲ می‌گیرد (§47).
 */

return [

    'sources' => ['support', 'test-bank', 'coordinated-exam', 'comprehensive', 'micro', 'question-lab', 'intl-courses'],

    'statuses' => ['open', 'answered', 'closed'],

    'subject_max' => 240,
    'category_max' => 64,
    'body_max' => 5000,
    'reply_body_max' => 4000,
    /* ref شفاف مهمان از مرورگر خودش (`tapesh:feedback-guest`) — هیچ هویتی حمل نمی‌کند. */
    'guest_ref_max' => 64,
    'meta_keys_max' => 10,

    'pagination' => [
        'per_page' => (int) env('FEEDBACK_PER_PAGE', 20),
        'max_per_page' => (int) env('FEEDBACK_MAX_PER_PAGE', 100),
    ],
];
