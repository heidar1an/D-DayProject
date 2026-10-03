<?php

/*
 * پیکربندی Study Groups — فاز ۱۶.
 *
 * مرز دامنه: Group فقط «عضویت و وضعیت گروه» را مالک است. Commerce/Payment
 * (plan واقعی، سفارش، اشتراک) فاز ۱۸ است — اینجا هیچ نمونهٔ اولیه‌ای از آن
 * ساخته نمی‌شود (§58)؛ `plan_id` فقط رشتهٔ اطلاع‌رسانی است، بدون FK.
 *
 * قواعد کد از قرارداد واقعی فرانت (groupService.js): پیشوند TP، الفبای بدون
 * نویسه‌های گیج‌کننده، ۶ نویسه، نرمال‌سازی اعداد فارسی/عربی و حذف جداکننده‌ها.
 */

return [

    'code' => [
        'prefix' => 'TP',
        'body_length' => 6,
        'alphabet' => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        /* کدهای بازنشستهٔ نگه‌داشته‌شده برای پاسخ صریح CODE_RETIRED (نه ۴۰۴ گمراه‌کننده). */
        'retired_keep' => 12,
    ],

    /* ظرفیت گروه — مطابق UI فعلی (§38). CHECK دیتابیس هم همان است. */
    'seats' => [
        'min' => 2,
        'max' => 3,
    ],

    /* plan_id فقط برچسب؛ هیچ رابطهٔ Commerce در این فاز نیست. */
    'default_plan_id' => 'group',

    'statuses' => ['active', 'archived'],

    'pagination' => [
        'per_page' => (int) env('GROUPS_PER_PAGE', 20),
        'max_per_page' => (int) env('GROUPS_MAX_PER_PAGE', 50),
    ],
];
