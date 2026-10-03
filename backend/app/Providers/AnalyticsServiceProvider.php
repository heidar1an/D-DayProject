<?php

namespace App\Providers;

use App\Events\Exam\ExamFinished;
use App\Events\Exam\ExamStarted;
use App\Events\Learning\LessonCompleted;
use App\Events\Learning\ProgressUpdated;
use App\Events\Learning\StudySessionRecorded;
use App\Events\QuestionBank\QuestionAnswered;
use App\Listeners\Analytics\RecordAnalyticsEvent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

/**
 * اتصال Domain Event ها به Analytics — فاز ۸.
 *
 * چرا Event و نه فراخوانی مستقیم: رویدادها **بعد از commit** به listener
 * می‌رسند (`ShouldHandleEventsAfterCommit`)، پس Analytics هرگز دادهٔ
 * نانهایی‌شده نمی‌خواند و شکستش تراکنش دامنه را برنمی‌گرداند (§59/§61).
 *
 * چرا `ProgressUpdated` هم وصل است: فقط برای invalidate کش — چون عدد
 * `reading_seconds` عوض شده. هیچ رویداد تحلیلی برایش ثبت نمی‌شود
 * (در `RecordAnalyticsEvent` نوعی برایش نیست)، پس جدول با رویداد پرحجم و
 * کم‌ارزش پر نمی‌شود.
 */
class AnalyticsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(ExamStarted::class, RecordAnalyticsEvent::class);
        Event::listen(ExamFinished::class, RecordAnalyticsEvent::class);
        Event::listen(LessonCompleted::class, RecordAnalyticsEvent::class);
        Event::listen(QuestionAnswered::class, RecordAnalyticsEvent::class);
        Event::listen(StudySessionRecorded::class, RecordAnalyticsEvent::class);
        Event::listen(ProgressUpdated::class, RecordAnalyticsEvent::class);
    }
}
