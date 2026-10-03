<?php

/*
 * پیکربندی گیمیفیکیشن و لیگ (فاز ۱۴).
 *
 * مرزها:
 *   • XP فقط از Ruleهای همین فایل صادر می‌شود؛ هیچ مقدار دلتایی از کلاینت
 *     خوانده نمی‌شود. تغییر فرمول فقط روی رویدادهای **بعدی** اثر دارد و
 *     تاریخچهٔ دفتر کل (`xp_transactions`) هرگز بازنویسی نمی‌شود.
 *   • قلب (heart_rewards) و XP دو ارز جدایند.
 */

return [

    /*
     * قواعد XP — `source_type` ⇒ دلتای ثابت.
     * کلید request هر رویداد سمت سرور ساخته می‌شود (`{source_type}:{source_id}`)
     * تا انتشار دوبارهٔ رویداد هرگز XP تکراری نسازد.
     */
    'xp_rules' => [
        'page_completed' => (int) env('XP_PAGE_COMPLETED', 20),
        'question_correct' => (int) env('XP_QUESTION_CORRECT', 5),
        'exam_finished' => (int) env('XP_EXAM_FINISHED', 50),
        'study_session' => (int) env('XP_STUDY_SESSION', 10),

        /*
         * XP چالش از `challenges.xp_reward` می‌آید، نه از این جدول.
         * `admin_adjustment` فقط با Action دامنه‌ای مجازِ آینده؛ endpoint عمومی ندارد.
         */
    ],

    'study_session' => [
        /* نشست کوتاه‌تر از این (ثانیه) XP نمی‌گیرد — جلوی فارم نشست‌های پوچ را می‌گیرد. */
        'min_seconds_for_xp' => (int) env('XP_STUDY_SESSION_MIN_SECONDS', 900),
    ],

    'league' => [
        /* فصل‌ها هفته‌ای‌اند و lazy ساخته می‌شوند؛ slug مثل `2026-W41`. */
        'season_granularity' => 'weekly',

        /* اندازهٔ صفحهٔ leaderboard و سقف مطلق. */
        'leaderboard_per_page' => (int) env('LEAGUE_LEADERBOARD_PER_PAGE', 20),
        'leaderboard_max_per_page' => (int) env('LEAGUE_LEADERBOARD_MAX_PER_PAGE', 50),

        /* همسایه‌های رتبه در /me/league. */
        'neighbor_count' => (int) env('LEAGUE_NEIGHBOR_COUNT', 2),
    ],

    'achievements' => [
        /*
         * شرط‌های deterministic روی دادهٔ واقعی بک‌اند. هر شرط = code ⇒ callback
         * semantic که در `AchievementService` تفسیر می‌شود (اینجا فقط کات‌ها).
         */
        'thresholds' => [
            'first_steps' => 1,
            'steps_25' => 25,
            'first_exam' => 1,
            'exams_5' => 5,
            'streak_7' => 7,
            'xp_1000' => 1000,
        ],
    ],

    'rate_limits' => [
        'league_read' => ['max' => (int) env('RATE_LEAGUE_READ_MAX', 120), 'decay_minutes' => (int) env('RATE_LEAGUE_READ_DECAY', 1)],
    ],

];
