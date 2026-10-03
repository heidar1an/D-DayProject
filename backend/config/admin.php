<?php

/*
 * پیکربندی پنل (فاز ۳ — حداقلِ لازم برای فاز ۶).
 *
 * هیچ عددی در کد hardcode نیست. اعداد rate limit «پیش‌فرض پیشنهادی» هستند، نه
 * عدد اندازه‌گیری‌شدهٔ سیستم.
 */

return [

    'rate_limits' => [
        'login' => ['max' => (int) env('RATE_ADMIN_LOGIN_MAX', 10), 'decay_minutes' => (int) env('RATE_ADMIN_LOGIN_DECAY', 15)],
        'logout' => ['max' => (int) env('RATE_ADMIN_LOGOUT_MAX', 30), 'decay_minutes' => (int) env('RATE_ADMIN_LOGOUT_DECAY', 1)],
        'me' => ['max' => (int) env('RATE_ADMIN_ME_MAX', 120), 'decay_minutes' => (int) env('RATE_ADMIN_ME_DECAY', 1)],
    ],

    /*
     * صفحه‌بندی پنل (فاز ۲۰). هر فهرست سقف دارد؛ «تمام رکوردها یک‌جا» ممنوع
     * است (§91) و هیچ عددی در کد hardcode نیست.
     */
    'pagination' => [
        'users_per_page' => (int) env('ADMIN_USERS_PER_PAGE', 30),
        'users_max_per_page' => (int) env('ADMIN_USERS_MAX_PER_PAGE', 100),
        'dashboard_top_limit' => (int) env('ADMIN_DASHBOARD_TOP_LIMIT', 10),
    ],

];
