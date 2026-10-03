<?php

namespace App\Listeners\Notifications;

use App\Events\Exam\ExamFinished;
use App\Services\Outbox\OutboxService;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * کارنامهٔ آزمون → اعلان — فاز ۱۹.
 *
 * مصرف‌کنندهٔ رخداد موجود فاز ۷ است؛ معماری Event تازه‌ای ساخته نشد. مسیر:
 *
 *   ExamFinished → Outbox → Queue → NotificationService → Delivery
 *
 * رخداد **بعد از commit** ثبت می‌شود (همان قرارداد §12) و `event_key` از
 * `attemptId` می‌آید ⇒ انتشار دوباره اعلان تکراری نمی‌سازد (§13/§27).
 *
 * Fail-soft: شکست اعلان هرگز مسیر آزمون را برنمی‌گرداند و لاگ می‌شود.
 */
final class QueueExamResultNotification implements ShouldHandleEventsAfterCommit
{
    public function __construct(
        private readonly OutboxService $outbox,
    ) {}

    public function handle(ExamFinished $event): void
    {
        if ($event->userId === null || $event->resultId === '') {
            return;
        }

        try {
            $this->outbox->record(
                eventKey: 'notification.exam_result:'.$event->attemptId,
                aggregateType: 'exam_attempt',
                aggregateId: $event->attemptId,
                eventType: 'notification.exam_result',
                payload: [
                    'userId' => $event->userId,
                    'entityId' => $event->resultId,
                    'title' => 'کارنامهٔ آزمون شما آماده است',
                    'body' => 'نتیجهٔ آزمون تصحیح شد. برای دیدن کارنامه به بخش آزمون‌ها بروید.',
                    'action' => '/dashboard/exams',
                ],
            );
        } catch (Throwable $error) {
            Log::warning('notification.exam_result_failed', [
                'attempt_id' => $event->attemptId,
                'error' => $error::class,
            ]);
        }
    }
}
