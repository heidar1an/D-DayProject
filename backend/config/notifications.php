<?php

/*
 * Notifications — فاز ۱۹.
 *
 * مرز: Notification **Delivery Projection** است، نه منبع حقیقت دامنه (§21).
 * رخداد دامنه حقیقت است؛ اعلان فقط بازتاب آن برای کاربر.
 *
 * `types` یک **allowlist** است (§19): نوع ناشناخته ⇒ استثنا، نه ذخیره.
 * هر نوع فقط کلیدهای payloadی را می‌پذیرد که UI واقعاً مصرف می‌کند.
 */

return [

    'table' => 'notifications',
    'deliveries_table' => 'notification_deliveries',

    /*
     * ── انواع اعلان ─────────────────────────────────────────────────────
     *
     * هر نوع یک **تولیدکنندهٔ واقعی** دارد؛ نوع بدون تولیدکننده ساخته نشد (§19):
     *   achievement_unlocked  ← AchievementService (ProcessActivity)
     *   exam_result           ← ExamFinished
     *   feedback_reply        ← پاسخ ادمین به بازخورد
     *   system                ← ارسال کنترل‌شده از پنل (تک‌کاربر یا گروهی)
     */
    'types' => [
        'achievement_unlocked' => [
            'label' => 'دستاورد',
            'channels' => ['in_app'],
            'payload_keys' => ['entityId', 'title', 'body', 'action', 'meta'],
            'title_required' => true,
        ],
        'exam_result' => [
            'label' => 'نتیجهٔ آزمون',
            'channels' => ['in_app'],
            'payload_keys' => ['entityId', 'title', 'body', 'action', 'meta'],
            'title_required' => true,
        ],
        'feedback_reply' => [
            'label' => 'پاسخ بازخورد',
            'channels' => ['in_app'],
            'payload_keys' => ['entityId', 'title', 'body', 'action', 'meta'],
            'title_required' => true,
        ],
        'system' => [
            'label' => 'سیستمی',
            'channels' => ['in_app'],
            'payload_keys' => ['entityId', 'title', 'body', 'action', 'meta'],
            'title_required' => true,
        ],
    ],

    /* کلیدهای مجاز payload — هر چیز دیگری دور ریخته می‌شود (§18). */
    'payload_keys' => ['entityId', 'title', 'body', 'action', 'meta'],

    /*
     * کلیدهای `meta` که هرگز ذخیره نمی‌شوند؛ payload اعلان هرگز نباید
     * رمز/توکن/سشن/منبع خصوصی حمل کند (§18/§28).
     */
    'meta_denied_keys' => [
        'password', 'password_hash', 'token', 'access_token', 'refresh_token',
        'secret', 'api_key', 'authorization', 'cookie', 'session', 'session_token',
        'card_number', 'cvv', 'iban', 'code', 'group_code', 'answer_key',
        'correct_answer', 'explanation',
    ],

    'limits' => [
        'title_max' => (int) env('NOTIFICATIONS_TITLE_MAX', 240),
        'body_max' => (int) env('NOTIFICATIONS_BODY_MAX', 2000),
        'action_max' => (int) env('NOTIFICATIONS_ACTION_MAX', 120),
        'meta_max_keys' => (int) env('NOTIFICATIONS_META_MAX_KEYS', 20),
        'meta_value_max' => (int) env('NOTIFICATIONS_META_VALUE_MAX', 300),
        'payload_max_bytes' => (int) env('NOTIFICATIONS_PAYLOAD_MAX_BYTES', 8192),
        'dedup_key_max' => (int) env('NOTIFICATIONS_DEDUP_KEY_MAX', 190),
    ],

    'pagination' => [
        'per_page' => (int) env('NOTIFICATIONS_PER_PAGE', 20),
        'max_per_page' => (int) env('NOTIFICATIONS_MAX_PER_PAGE', 50),
    ],

    /*
     * ── کانال‌ها (§21) ──────────────────────────────────────────────────
     *
     * فقط `in_app` مسیر واقعی این فاز است. email/sms/push فقط اگر Provider،
     * Consent و Quota واقعی وجود داشته باشد فعال می‌شوند (§16/§29)؛ پیش‌فرض
     * `false` است و بدون Provider فعال‌شدن یعنی تحویل دروغین.
     */
    'channels' => [
        'in_app' => [
            'enabled' => true,
            'provider' => 'in_app',
        ],
        'email' => [
            'enabled' => (bool) env('NOTIFICATIONS_EMAIL_ENABLED', false),
            'provider' => env('NOTIFICATIONS_EMAIL_PROVIDER', 'null'),
            'requires_consent' => true,
        ],
        'sms' => [
            'enabled' => (bool) env('NOTIFICATIONS_SMS_ENABLED', false),
            'provider' => env('NOTIFICATIONS_SMS_PROVIDER', 'null'),
            'requires_consent' => true,
        ],
        'push' => [
            'enabled' => (bool) env('NOTIFICATIONS_PUSH_ENABLED', false),
            'provider' => env('NOTIFICATIONS_PUSH_PROVIDER', 'null'),
            'requires_consent' => true,
        ],
    ],

    'delivery' => [
        'queue' => env('QUEUE_NAME_NOTIFICATIONS', 'notifications'),
        'tries' => (int) env('NOTIFICATIONS_DELIVERY_TRIES', 3),
        'backoff' => [30, 120, 600],
        'timeout' => (int) env('NOTIFICATIONS_DELIVERY_TIMEOUT', 20),
    ],

    /* ارسال گروهی پنل — batch محدود و صف‌شده؛ «bulk بدون limit ممنوع» (§103). */
    'broadcast' => [
        'enabled' => (bool) env('NOTIFICATIONS_BROADCAST_ENABLED', true),
        'chunk' => (int) env('NOTIFICATIONS_BROADCAST_CHUNK', 200),
        'max_recipients' => (int) env('NOTIFICATIONS_BROADCAST_MAX', 100000),
    ],

    'retention' => [
        'read_days' => (int) env('NOTIFICATIONS_READ_RETENTION_DAYS', 90),
        'any_days' => (int) env('NOTIFICATIONS_RETENTION_DAYS', 365),
        'batch' => (int) env('NOTIFICATIONS_PRUNE_BATCH', 500),
    ],

];
