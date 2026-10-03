<?php

use App\Services\Outbox\Handlers\NotificationOutboxHandler;
use App\Services\Outbox\Handlers\SearchOutboxHandler;

/*
 * Outbox — فاز ۱۹.
 *
 * هدف: تضمین اینکه «دامنه commit شد ولی رخداد گم شد» رخ ندهد (§12).
 *
 * چرا `handlers` نگاشت صریح است و نه `match` در Job: افزودن نوع تازه نباید Job
 * را تغییر دهد، و نوع بدون handler باید **دیده شود** (Job fail می‌شود و در
 * dead-letter می‌نشیند) نه اینکه بی‌صدا رد شود (§10/§23).
 */

return [

    'table' => 'outbox_events',

    /*
     * Sweeper: رخدادهای منتشرنشده‌ای که مسیر «dispatch بلافاصله» را ندیدند.
     * `max_age_hours` از انتشار رخدادهای بسیار کهنه جلوگیری می‌کند (رخداد
     * کهنه = اثر بی‌ربط).
     */
    'sweep' => [
        'enabled' => (bool) env('OUTBOX_SWEEP_ENABLED', true),
        'batch' => (int) env('OUTBOX_SWEEP_BATCH', 200),
        'max_age_hours' => (int) env('OUTBOX_SWEEP_MAX_AGE_HOURS', 24),
    ],

    /* نگهداشت رخدادهای منتشرشده — batch محدود، توسط `ops:prune`. */
    'retention' => [
        'published_days' => (int) env('OUTBOX_RETENTION_DAYS', 14),
    ],

    'queue' => env('QUEUE_NAME_OUTBOX', 'outbox'),

    /*
     * ── انواع رخداد و handler ───────────────────────────────────────────
     *
     *   notification.*  → NotificationService (تحویل اعلان)
     *   search.index    → ایندکس‌گذاری سند
     *   search.remove   → حذف سند از ایندکس
     */
    'handlers' => [
        'notification.achievement_unlocked' => NotificationOutboxHandler::class,
        'notification.exam_result' => NotificationOutboxHandler::class,
        'notification.feedback_reply' => NotificationOutboxHandler::class,
        'notification.system' => NotificationOutboxHandler::class,

        'search.index' => SearchOutboxHandler::class,
        'search.remove' => SearchOutboxHandler::class,
    ],

    /*
     * حداقل دادهٔ payload (§17): هیچ آبجکت کامل دامنه، هیچ رمز/توکن.
     * `payload_keys` در NotificationOutboxHandler نیز دوباره فیلتر می‌شود.
     */
    'payload_max_bytes' => (int) env('OUTBOX_PAYLOAD_MAX_BYTES', 8192),

];
