<?php

/*
 * پیکربندی یادگیری (فاز ۵).
 *
 * ⚠️ همهٔ اعداد «سقف محافظتی» هستند، نه benchmark اندازه‌گیری‌شده. هیچ‌کدام
 * hardcode نیستند و از `.env` قابل تغییرند.
 */

return [

    'progress' => [
        /*
         * سقف دلتای `secondsSpent` در هر درخواست.
         *
         * چرا سقف لازم است: بدون آن، یک کلاینت خراب یا مهاجم می‌تواند در یک
         * درخواست عددهای نجومی بفرستد. ۶۰۰ ثانیه (۱۰ دقیقه) یعنی autosave
         * چندثانیه‌ای UI فعلی هرگز به سقف نمی‌خورد ولی سوءاستفاده هم ممکن نیست.
         */
        'max_seconds_per_update' => (int) env('LEARNING_MAX_SECONDS_PER_UPDATE', 600),

        /* سقف `lastPosition` — فقط clamp است، نه رد درخواست (یکنوا نیست). */
        'max_position' => (int) env('LEARNING_MAX_POSITION', 10000),
    ],

    'study_sessions' => [
        'max_duration_seconds' => (int) env('LEARNING_MAX_SESSION_SECONDS', 14400),
        'max_clock_skew_seconds' => (int) env('LEARNING_MAX_CLOCK_SKEW', 120),
        'max_backdate_days' => (int) env('LEARNING_MAX_BACKDATE_DAYS', 30),
        'duration_tolerance_seconds' => (int) env('LEARNING_DURATION_TOLERANCE', 30),

        /*
         * فهرست source — سه مقداری که در Frontend فعلی قابل اثبات است:
         * خوانندهٔ درس، میکرودرس، و تایمر پومودورو. مقدار تازه فقط با
         * مصرف‌کنندهٔ واقعی اضافه شود (و با migration، چون CHECK دارد).
         */
        'sources' => ['lesson', 'micro_lesson', 'pomodoro'],
    ],

    'rate_limits' => [
        'progress_read' => ['max' => (int) env('RATE_PROGRESS_READ_MAX', 240), 'decay_minutes' => (int) env('RATE_PROGRESS_READ_DECAY', 1)],
        'progress_write' => ['max' => (int) env('RATE_PROGRESS_WRITE_MAX', 120), 'decay_minutes' => (int) env('RATE_PROGRESS_WRITE_DECAY', 1)],
        'study_session' => ['max' => (int) env('RATE_STUDY_SESSION_MAX', 60), 'decay_minutes' => (int) env('RATE_STUDY_SESSION_DECAY', 1)],
    ],

];
