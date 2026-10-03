<?php

/*
 * Audit — فاز ۲۰ (§82/§83).
 *
 * Audit **append-only و تغییرناپذیر** است: هیچ مسیری رکورد audit را ویرایش یا
 * حذف نمی‌کند. مدل هم قفل شده است (بدون update/delete).
 *
 * هیچ رمز/توکن/بدنهٔ خام ذخیره نمی‌شود؛ فقط فهرست کلیدها و مقدارهای redactشده.
 */

return [

    'table' => 'audit_logs',

    'pagination' => [
        'per_page' => (int) env('AUDIT_PER_PAGE', 30),
        'max_per_page' => (int) env('AUDIT_MAX_PER_PAGE', 100),
    ],

    /*
     * کلیدهایی که هرگز مقدارشان ثبت نمی‌شود — نام کلید می‌ماند تا بدانیم تغییر
     * داده شده، ولی مقدارش redact می‌شود (§83).
     */
    'redact_keys' => [
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
        'token',
        'secret',
        'api_key',
        'apikey',
        'authorization',
        'cookie',
        'session',
        'code',
        'group_code',
        'card_number',
        'cvv',
        'iban',
    ],

    'redacted_placeholder' => '[REDACTED]',

    /*
     * مسیرهایی که بدنهٔ درخواستشان **هرگز** در audit ثبت نمی‌شود.
     *
     * چرا لازم است: برخی بدنه‌ها ذاتاً حامل راز‌اند (کلید درگاه، رمز) و
     * redact بر اساس **نام کلید** کار می‌کند؛ اگر نام کلید عمومی باشد (`value`)
     * راز ذخیره می‌شود. برای این مسیرها فقط خودِ کنترلر audit صریح و
     * بی‌راز می‌نویسد.
     */
    'body_exempt_routes' => [
        'api.v1.admin.settings.update',
    ],

    /* سقف بدنهٔ ثبت‌شده — بدنهٔ حجیم در audit ذخیره نمی‌شود. */
    'max_field_length' => (int) env('AUDIT_MAX_FIELD_LENGTH', 500),
    'max_fields' => (int) env('AUDIT_MAX_FIELDS', 40),

    /* نگهداشت — batch محدود، توسط زمان‌بند. */
    'retention' => [
        'days' => (int) env('AUDIT_RETENTION_DAYS', 730),
        'batch' => (int) env('AUDIT_RETENTION_BATCH', 500),
    ],

];
