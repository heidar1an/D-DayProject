<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| زمان‌بند — فاز ۱۹/۲۰
|--------------------------------------------------------------------------
|
| زمان‌بند فقط کارهای **تعمیراتی و bounded** را اجرا می‌کند؛ هیچ Business Logic
| سنگینی اینجا نیست (§14). هر دستور خودش batch-limited است.
|
| چرا outbox:publish هر ۵ دقیقه: مسیر اصلی انتشار، dispatch بلافاصله بعد از
| ثبت رخداد است؛ این زمان‌بند **شبکهٔ ایمنی** برای رخدادهایی است که آن مسیر را
| ندیدند (پراسس مرده، صف پاک‌شده). نتیجه: «دامنه commit شد ولی رخداد گم شد»
| فقط تا ۵ دقیقه تأخیر می‌خورد، گم نمی‌شود.
*/

Schedule::command('outbox:publish')
    ->everyFiveMinutes()
    ->withoutOverlapping();

Schedule::command('outbox:publish --prune')
    ->dailyAt('03:30')
    ->withoutOverlapping();

/*
 * Rebuild شبانه به‌صورت **صف‌شده** است تا دستور CLI طولانی نشود و Worker
 * محدودیت حافظه را رعایت کند. ایندکس projection است؛ rebuild چیزی را در
 * دامنه تغییر نمی‌دهد (§41).
 */
Schedule::command('search:rebuild --queue')
    ->dailyAt('03:00')
    ->withoutOverlapping();

Schedule::command('ops:prune')
    ->dailyAt('04:00')
    ->withoutOverlapping();
