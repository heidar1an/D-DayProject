<?php

/*
 * پیکربندی موتور آزمون (فاز ۷).
 *
 * ⚠️ همهٔ اعداد «سقف محافظتی/پیش‌فرض پیشنهادی» هستند، نه benchmark اندازه‌گیری‌شده.
 * هیچ‌کدام hardcode نیستند و از `.env` قابل تغییرند.
 *
 * مرز دامنه (Blueprint §4): این ماژول مالک `exams`, `exam_questions`,
 * `exam_registrations`, `exam_attempts`, `exam_answers`, `exam_results` است.
 * کلید پاسخ همچنان مالکیت `question_keys` است؛ `exam_questions.key_snapshot_encrypted`
 * فقط **عکس لحظه‌ای** آن در زمان انتشار آزمون است، نه منبع جدید حقیقت.
 */

return [

    /*
     * انواع آزمون. `kind` تنها تمایز موتور است — نه سه موتور جدا.
     * مقادیر `quiz`/`personal`/`coordinated`/`international` از UI فعلی استخراج
     * شده‌اند (`coordinatedExamService.TYPE_META` + `examBuilderService` +
     * `internationalService`). `type` نمایشی ریزتر در ستون جدا نگه داشته می‌شود.
     */
    'kinds' => ['quiz', 'personal', 'coordinated', 'international'],

    /*
     * چرخهٔ عمر آزمون — کنترل ادمین. فاز زمانی (LIVE/FINISHED/…) از ساعت سرور
     * مشتق می‌شود و این ستون را جایگزین نمی‌کند.
     * `draft` هرگز در API عمومی دیده نمی‌شود.
     */
    'statuses' => ['draft', 'scheduled', 'open', 'closed', 'archived'],

    /*
     * وضعیت‌های Attempt — **فقط حالت‌هایی که نویسندهٔ واقعی دارند**.
     *
     * `pending`/`submitted`/`cancelled` عمداً نیستند: تصحیح همگام و در همان
     * تراکنش `finish` انجام می‌شود، پس حالت میانی `submitted` هرگز persist
     * نمی‌شود؛ و هیچ مصرف‌کننده‌ای برای لغو Attempt (نه در UI، نه در پنل) وجود
     * ندارد. افزودنشان «طراحی‌شده» را به‌جای «پیاده‌شده» جا می‌زند.
     */
    'attempt_statuses' => ['in_progress', 'graded', 'expired'],

    /* گذارهای مجاز — هر گذار دیگری از سمت سرور رد می‌شود. */
    'attempt_transitions' => [
        'in_progress' => ['graded', 'expired'],
        'graded' => [],
        'expired' => [],
    ],

    /* دلایل پایان — همان مجموعهٔ legacy (`sanitizeReason`). */
    'submit_reasons' => ['user', 'auto', 'grace', 'timeout'],

    'pagination' => [
        'per_page' => (int) env('EXAM_PER_PAGE', 20),
        'max_per_page' => (int) env('EXAM_MAX_PER_PAGE', 50),
    ],

    'limits' => [
        /* سقف تعداد سؤال یک آزمون — فقط clamp زمان snapshot. */
        'max_questions' => (int) env('EXAM_MAX_QUESTIONS', 300),
        /* سقف تعداد گزینه در snapshot. */
        'max_options' => (int) env('EXAM_MAX_OPTIONS', 8),
        /* سقف طول عنوان/توضیح برای جلوگیری از بدنهٔ نجومی. */
        'max_title' => (int) env('EXAM_MAX_TITLE', 200),
        'max_description' => (int) env('EXAM_MAX_DESCRIPTION', 4000),
    ],

    /*
     * مهلت ارسال پس از `deadline_at` (ثانیه). همان معنای `graceSeconds` در
     * `examStore.js`: پاسخ تا deadline، submit تا deadline+grace.
     */
    'default_grace_seconds' => (int) env('EXAM_DEFAULT_GRACE_SECONDS', 30),

    'ranking' => [
        /* سقف تعداد ردیف بازگشتی در رتبه‌بندی — pagination اجباری. */
        'max_limit' => (int) env('EXAM_RANKING_MAX_LIMIT', 100),
        'default_limit' => (int) env('EXAM_RANKING_LIMIT', 20),
    ],

    /*
     * rate limit ها — نام‌دار و از config. کلیدشان HMAC آی‌پی یا شناسهٔ بازیگر است؛
     * IP خام هرگز ذخیره/لاگ نمی‌شود. اعداد از `examApi.js` (لایهٔ legacy) گرفته
     * شده‌اند تا رفتار پیش از cutover عوض نشود.
     */
    'rate_limits' => [
        'read' => ['max' => (int) env('RATE_EXAM_READ_MAX', 120), 'decay_minutes' => (int) env('RATE_EXAM_READ_DECAY', 1)],
        'registration' => ['max' => (int) env('RATE_EXAM_REGISTRATION_MAX', 30), 'decay_minutes' => (int) env('RATE_EXAM_REGISTRATION_DECAY', 1)],
        'attempt_start' => ['max' => (int) env('RATE_EXAM_START_MAX', 12), 'decay_minutes' => (int) env('RATE_EXAM_START_DECAY', 1)],
        'answer' => ['max' => (int) env('RATE_EXAM_ANSWER_MAX', 240), 'decay_minutes' => (int) env('RATE_EXAM_ANSWER_DECAY', 1)],
        'finish' => ['max' => (int) env('RATE_EXAM_FINISH_MAX', 20), 'decay_minutes' => (int) env('RATE_EXAM_FINISH_DECAY', 1)],
        'result' => ['max' => (int) env('RATE_EXAM_RESULT_MAX', 120), 'decay_minutes' => (int) env('RATE_EXAM_RESULT_DECAY', 1)],
        'ranking' => ['max' => (int) env('RATE_EXAM_RANKING_MAX', 120), 'decay_minutes' => (int) env('RATE_EXAM_RANKING_DECAY', 1)],
    ],

];
