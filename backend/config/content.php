<?php

/*
 * پیکربندی محتوا (فاز ۴).
 *
 * اعداد صفحه‌بندی «پیش‌فرض پیشنهادی Blueprint» هستند (`page+perPage<=50`)، نه
 * عدد اندازه‌گیری‌شده. هیچ‌کدام hardcode نیستند.
 */

return [

    'pagination' => [
        'per_page' => (int) env('CONTENT_PER_PAGE', 20),
        'max_per_page' => (int) env('CONTENT_MAX_PER_PAGE', 50),
    ],

    'rate_limits' => [
        'read' => ['max' => (int) env('RATE_CONTENT_READ_MAX', 120), 'decay_minutes' => (int) env('RATE_CONTENT_READ_DECAY', 1)],
    ],

];
