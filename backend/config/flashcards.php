<?php

/*
 * پیکربندی فلش‌کارت — فاز ۹.
 *
 * ⚠️ همهٔ اعداد «سقف محافظتی/پیش‌فرض پیشنهادی» هستند، نه benchmark اندازه‌گیری‌شده.
 *
 * مرز دامنه: Flashcards مالک «یادگیری شخصی/رسمی» است. هیچ XP، هیچ لیگ، هیچ
 * entitlement و هیچ AI اینجا نیست (فاز ۹ صریحاً آن‌ها را ممنوع کرده).
 */

return [

    /*
     * الگوریتم Spaced Repetition.
     *
     * `default_version` همان رشته‌ای است که فرانت‌اند فعلی در
     * `src/services/flashcards/spacedRepetition.js` به‌عنوان `ALGORITHM_VERSION`
     * اعلام می‌کند. یکی بودن این دو عمدی است: اگر روزی داده‌ای از کلاینت مهاجرت
     * کند، «کدام نسخه محاسبه کرده» باید یک معنا داشته باشد.
     *
     * استراتژی‌ها **قابل تعویض**اند: هر نسخه یک کلاس جدا و ثبت‌شده در
     * `FlashcardServiceProvider` است. هیچ نسخه‌ای دیگری را بازمحاسبه نمی‌کند.
     */
    'algorithm' => [
        'default_version' => env('FLASHCARD_ALGORITHM_VERSION', 'sm2-tapesh-v1'),

        /* پارامترهای V1 — آینهٔ `DEFAULT_ALGORITHM_CONFIG` فرانت‌اند. */
        'v1' => [
            'learning_steps_minutes' => [10, 1440],
            'relearning_steps_minutes' => [10],
            'graduating_interval_days' => 4,
            'easy_interval_days' => 10,
            'starting_ease' => 2.5,
            'easy_bonus' => 1.3,
            'hard_factor' => 1.2,
            'interval_modifier' => 1.0,
            'max_interval_days' => 365,
            'min_ease' => 1.3,
            'lapse_ease_penalty' => 0.2,
            'new_interval_after_lapse_days' => 1,
        ],
    ],

    /*
     * Ratingهای canonical.
     *
     * از UI و `mockData` استخراج شده‌اند (همان چهار دکمهٔ Anki‌مانند). کلاینت
     * **فقط** همین مقادیر را می‌فرستد؛ `interval`/`ease`/`next_due_at` هرگز.
     */
    'ratings' => ['again', 'hard', 'good', 'easy'],

    /* حالت‌های مجاز `flashcard_states.state` — همان واژگان فرانت‌اند. */
    'states' => ['new', 'learning', 'review', 'relearning', 'mastered', 'suspended', 'archived'],

    'decks' => [
        'title_max' => (int) env('FLASHCARD_DECK_TITLE_MAX', 160),
        'description_max' => (int) env('FLASHCARD_DECK_DESCRIPTION_MAX', 1000),
        'statuses' => ['draft', 'published', 'archived'],
        'visibilities' => ['private', 'public'],
        /* سقف کارت در یک درخواست دسته‌ای (import) — جلوی بدنهٔ غول‌آسا را می‌گیرد. */
        'max_cards_per_request' => (int) env('FLASHCARD_MAX_CARDS_PER_REQUEST', 100),
        /* سقف کارت یک دک — محافظت از سوءاستفاده، نه محدودیت محصولی. */
        'max_cards_per_deck' => (int) env('FLASHCARD_MAX_CARDS_PER_DECK', 2000),
    ],

    'cards' => [
        'front_max' => (int) env('FLASHCARD_FRONT_MAX', 4000),
        'back_max' => (int) env('FLASHCARD_BACK_MAX', 8000),
        'statuses' => ['active', 'suspended', 'archived'],
    ],

    'review' => [
        /* حداکثر بازهٔ bury (روز) — «بی‌صدا کردن موقت کارت». */
        'max_bury_days' => (int) env('FLASHCARD_MAX_BURY_DAYS', 30),
        'default_bury_days' => (int) env('FLASHCARD_DEFAULT_BURY_DAYS', 1),
        /*
         * سقف تعداد کارت «نو» در صف مرور. بدون این سقف، کاربر تازه با هزاران
         * کارت نو روبه‌رو می‌شود و صف بی‌معنا می‌شود. کلاینت می‌تواند کمتر بخواهد،
         * بیشتر نه.
         */
        'max_new_per_queue' => (int) env('FLASHCARD_MAX_NEW_PER_QUEUE', 20),
        'modes' => ['today', 'deck', 'weak', 'cram'],
        'queue_limit_default' => (int) env('FLASHCARD_QUEUE_LIMIT', 40),
        'queue_limit_max' => (int) env('FLASHCARD_QUEUE_LIMIT_MAX', 100),
        /*
         * آستانهٔ «تسلط» — آینهٔ `isMastered()` فرانت‌اند. مشتق است، نه وضعیت
         * قابل‌تنظیم توسط کلاینت.
         */
        'mastery_score' => (int) env('FLASHCARD_MASTERY_SCORE', 85),
        'mastery_interval_days' => (int) env('FLASHCARD_MASTERY_INTERVAL_DAYS', 21),
    ],

    'pagination' => [
        'per_page' => (int) env('FLASHCARD_PER_PAGE', 20),
        'max_per_page' => (int) env('FLASHCARD_MAX_PER_PAGE', 50),
    ],

    /*
     * محتوای کارت ممکن است HTML/Markdown سبک باشد. این کلید تعیین می‌کند آیا
     * `front`/`back` پیش از ذخیره از فیلتر whitelist عبور کنند یا نه.
     *
     * چرا کلید و نه همیشه: کارت‌های فعلی متن ساده‌اند؛ خاموش‌کردن فیلتر باید
     * آگاهانه و مستند باشد، نه پیش‌فرض.
     */
    'sanitize' => [
        'enabled' => (bool) env('FLASHCARD_SANITIZE', true),
    ],

    'rate_limits' => [
        'read' => ['max' => (int) env('RATE_FLASHCARD_READ_MAX', 240), 'decay_minutes' => (int) env('RATE_FLASHCARD_READ_DECAY', 1)],
        'write' => ['max' => (int) env('RATE_FLASHCARD_WRITE_MAX', 120), 'decay_minutes' => (int) env('RATE_FLASHCARD_WRITE_DECAY', 1)],
        'review' => ['max' => (int) env('RATE_FLASHCARD_REVIEW_MAX', 600), 'decay_minutes' => (int) env('RATE_FLASHCARD_REVIEW_DECAY', 1)],
        'admin' => ['max' => (int) env('RATE_ADMIN_FLASHCARD_MAX', 180), 'decay_minutes' => (int) env('RATE_ADMIN_FLASHCARD_DECAY', 1)],
    ],

    /*
     * کش فهرست دک‌های **رسمی**. وضعیت کاربر، صف مرور و دک خصوصی هرگز cache
     * مشترک نمی‌شوند (فاز ۹ §49).
     */
    'cache' => [
        'official_decks_ttl_seconds' => (int) env('FLASHCARD_OFFICIAL_DECKS_TTL', 60),
    ],

    /*
     * مهاجرت localStorage — فاز ۹ §22.
     *
     * `import_enabled=false` یعنی هیچ مسیر import وجود ندارد. عمدی است: ورود
     * دادهٔ کلاینت بدون نسخه/مالکیت/consent/rollback ممنوع است و Review History
     * بدون اثبات یکپارچگی معتبر نیست. آداپتر سازگاری جدا خواهد بود.
     */
    'client_migration' => [
        'import_enabled' => (bool) env('FLASHCARD_CLIENT_IMPORT', false),
        'supported_payload_versions' => ['tapesh:flashcards:v1'],
    ],

];
