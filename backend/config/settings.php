<?php

/*
 * System Settings — فاز ۲۰ (§80/§81).
 *
 * فقط کلیدهای این allowlist قابل مدیریت‌اند. کلید ناشناخته ⇒ ۴۲۲ (نه ایجاد
 * پویا): تنظیم ناشناخته یعنی سطح حملهٔ تازه.
 *
 * `secret` ⇒ مقدار هرگز در پاسخ خوانده نمی‌شود (masked) و فقط نوشتنی است.
 * `version` ⇒ optimistic lock؛ دو ادمین هم‌زمان ⇒ ۴۰۹ (§81/§93).
 */

return [

    'table' => 'system_settings',

    'keys' => [
        'site.maintenance_mode' => [
            'type' => 'boolean',
            'default' => false,
            'description' => 'حالت تعمیر سایت',
            'secret' => false,
            'permission' => 'settings.update',
        ],
        'site.announcement' => [
            'type' => 'string',
            'default' => '',
            'description' => 'متن اطلاعیهٔ سراسری',
            'secret' => false,
            'permission' => 'settings.update',
            'max' => 500,
        ],
        'content.default_page_size' => [
            'type' => 'integer',
            'default' => 20,
            'description' => 'تعداد پیش‌فرض آیتم هر صفحه',
            'secret' => false,
            'permission' => 'settings.update',
            'min' => 1,
            'max' => 200,
        ],
        'search.enabled' => [
            'type' => 'boolean',
            'default' => true,
            'description' => 'فعال بودن جست‌وجوی عمومی',
            'secret' => false,
            'permission' => 'settings.update',
        ],
        'notifications.broadcast_enabled' => [
            'type' => 'boolean',
            'default' => true,
            'description' => 'فعال بودن ارسال گروهی اعلان از پنل',
            'secret' => false,
            'permission' => 'settings.update',
        ],
        'security.force_admin_reauth_minutes' => [
            'type' => 'integer',
            'default' => 0,
            'description' => 'اجبار ورود مجدد ادمین (دقیقه؛ ۰ = خاموش)',
            'secret' => false,
            'permission' => 'settings.security.manage',
            'min' => 0,
            'max' => 1440,
        ],
        'integration.gateway_api_key' => [
            'type' => 'string',
            'default' => '',
            'description' => 'کلید درگاه پرداخت (نوشتنی، خوانده نمی‌شود)',
            'secret' => true,
            'permission' => 'settings.security.manage',
            'max' => 500,
        ],
    ],

    'pagination' => [
        'per_page' => (int) env('SETTINGS_PER_PAGE', 50),
    ],

    /* مقدار نمایشی برای کلید محرمانه در پاسخ — مقدار واقعی هرگز serialize نمی‌شود. */
    'secret_placeholder' => '••••••••',

];
