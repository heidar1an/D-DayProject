<?php

// پیکربندی پایهٔ API (فاز ۱). ماژول‌های محصول در فازهای بعد پیکربندی خودشان را
// اضافه می‌کنند؛ هیچ منطق کسب‌وکاری اینجا نیست.

return [

    'request_id_header' => env('API_REQUEST_ID_HEADER', 'X-Request-Id'),

    // readiness probes فعال روی /api/v1/readyz
    'readyz' => [
        'database' => env('READYZ_CHECK_DATABASE', true),
        'redis' => env('READYZ_CHECK_REDIS', true),
    ],

    'redis_connection' => env('REDIS_READYZ_CONNECTION', 'cache'),

    /*
     * عمر کلیدهای idempotency (فاز ۵/۶).
     *
     * چرا TTL و نه نگهداری دائمی: این جدول transient است، نه ledger. کلیدی که
     * یک روز بازپخش می‌شود برای double-click و retry شبکه کافی است؛ نگه‌داشتن
     * ابدی آن فقط جدول را بی‌دلیل بزرگ می‌کند.
     */
    'idempotency' => [
        'ttl_minutes' => (int) env('API_IDEMPOTENCY_TTL_MINUTES', 1440),
        'header' => env('API_IDEMPOTENCY_HEADER', 'Idempotency-Key'),
    ],

    // HTTP status → error code پایدار (مرجع: docs/api.md). فقط توسعه داده می‌شود؛
    // کدهای منتشرشده هرگز تغییر نام نمی‌گیرند.
    'error_codes' => [
        400 => 'BAD_REQUEST',
        401 => 'UNAUTHENTICATED',
        403 => 'FORBIDDEN',
        404 => 'NOT_FOUND',
        405 => 'METHOD_NOT_ALLOWED',
        409 => 'CONFLICT',
        413 => 'PAYLOAD_TOO_LARGE',
        415 => 'UNSUPPORTED_MEDIA_TYPE',
        422 => 'VALIDATION_FAILED',
        429 => 'RATE_LIMITED',
        500 => 'INTERNAL_ERROR',
        503 => 'SERVICE_UNAVAILABLE',
    ],
];
