<?php

/*
 * پیکربندی بانک سؤال (فاز ۶).
 *
 * ⚠️ همهٔ اعداد «سقف محافظتی/پیش‌فرض پیشنهادی» هستند، نه benchmark اندازه‌گیری‌شده.
 * هیچ‌کدام hardcode نیستند.
 */

return [

    'pagination' => [
        'per_page' => (int) env('QUESTION_BANK_PER_PAGE', 20),
        'max_per_page' => (int) env('QUESTION_BANK_MAX_PER_PAGE', 50),
    ],

    'limits' => [
        'max_options' => (int) env('QUESTION_BANK_MAX_OPTIONS', 8),
        'report_body_max' => (int) env('QUESTION_BANK_REPORT_BODY_MAX', 1000),
    ],

    'attempts' => [
        /* سقف `timeSpent` کلاینت — فقط توصیفی است و clamp می‌شود. */
        'max_time_spent_seconds' => (int) env('QUESTION_BANK_MAX_TIME_SPENT', 3600),
    ],

    /*
     * بازگشایی کلید پاسخ. `true` = همان رفتار واقعی محصول: پس از ثبت پاسخ و
     * فقط برای همان سؤال. اگر محصول روزی بازگشایی را به موعد موکول کند، همین
     * کلید عوض می‌شود و `QuestionRevealService` تنها نقطهٔ تغییر است.
     */
    'reveal' => [
        'after_answer' => (bool) env('QUESTION_BANK_REVEAL_AFTER_ANSWER', true),
    ],

    'hearts' => [
        /*
         * مقدار پاداش — **از کلاینت گرفته نمی‌شود**. `0` یعنی «سیستم قلب فعال
         * نیست» و در آن حالت هیچ رکوردی نوشته نمی‌شود (بدون mock).
         */
        'reward_amount' => (int) env('QUESTION_BANK_HEART_REWARD', 1),
    ],

    'bank_session' => [
        'ttl_minutes' => (int) env('BANK_SESSION_TTL_MINUTES', 120),
        'default_count' => (int) env('BANK_SESSION_DEFAULT_COUNT', 20),
        'max_count' => (int) env('BANK_SESSION_MAX_COUNT', 100),
        'modes' => ['practice', 'exam'],
    ],

    'rate_limits' => [
        'read' => ['max' => (int) env('RATE_QUESTIONS_READ_MAX', 120), 'decay_minutes' => (int) env('RATE_QUESTIONS_READ_DECAY', 1)],
        'answer' => ['max' => (int) env('RATE_QUESTIONS_ANSWER_MAX', 120), 'decay_minutes' => (int) env('RATE_QUESTIONS_ANSWER_DECAY', 1)],
        'report' => ['max' => (int) env('RATE_QUESTIONS_REPORT_MAX', 20), 'decay_minutes' => (int) env('RATE_QUESTIONS_REPORT_DECAY', 60)],
        'bank_session' => ['max' => (int) env('RATE_BANK_SESSION_MAX', 30), 'decay_minutes' => (int) env('RATE_BANK_SESSION_DECAY', 1)],
        'admin' => ['max' => (int) env('RATE_ADMIN_QUESTIONS_MAX', 120), 'decay_minutes' => (int) env('RATE_ADMIN_QUESTIONS_DECAY', 1)],
    ],

];
