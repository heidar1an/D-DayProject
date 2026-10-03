<?php

namespace App\Listeners\Analytics;

use App\Events\Exam\ExamFinished;
use App\Events\Exam\ExamStarted;
use App\Events\Learning\LessonCompleted;
use App\Events\Learning\ProgressUpdated;
use App\Events\Learning\StudySessionRecorded;
use App\Events\QuestionBank\QuestionAnswered;
use App\Services\Analytics\AnalyticsEventRecorder;
use App\Services\Analytics\AnalyticsService;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * ثبت رویداد تحلیلی از Domain Event — فاز ۸.
 *
 * سه تصمیم که این کلاس را درست می‌کند:
 *
 *   1. **`ShouldHandleEventsAfterCommit`** — این listener فقط پس از commit شدن
 *      تراکنش دامنه اجرا می‌شود. پس Analytics هرگز نتیجه‌ای را نمی‌خواند که
 *      ممکن است rollback شود (§61)، و شکست آن تراکنش تصحیح آزمون را برنمی‌گرداند.
 *
 *   2. **Idempotent** — کلید رویداد از شناسهٔ دامنه ساخته می‌شود
 *      (`exam.finished:{attemptId}`)، پس انتشار دوباره رکورد تکراری نمی‌سازد (§62).
 *
 *   3. **Fail-soft** — هر خطای غیرمنتظره لاگ می‌شود و **بلعیده** می‌شود. تحلیل
 *      نباید هرگز مسیر کاربر را بشکند؛ ولی خطا هم بی‌صدا نمی‌ماند.
 */
class RecordAnalyticsEvent
{
    public function __construct(
        private readonly AnalyticsEventRecorder $recorder,
        private readonly AnalyticsService $analytics,
    ) {}

    public function handle(object $event): void
    {
        try {
            $this->record($event);
        } catch (Throwable $error) {
            /* فقط نوع خطا و کلاس رویداد — نه payload (ممکن است حاوی داده باشد). */
            Log::warning('analytics.listener_failed', [
                'event' => $event::class,
                'error' => $error::class,
            ]);
        }
    }

    private function record(object $event): void
    {
        match (true) {
            $event instanceof ExamStarted => $this->recorder->record(
                eventKey: "exam.started:{$event->attemptId}",
                eventType: 'exam_started',
                userId: $event->userId,
                properties: ['exam_id' => $event->examId, 'kind' => $event->kind],
            ),

            $event instanceof ExamFinished => $this->recordExamFinished($event),

            $event instanceof LessonCompleted => $this->recorder->record(
                eventKey: "lesson.completed:{$event->userId}:{$event->lessonPageId}",
                eventType: 'lesson_completed',
                userId: $event->userId,
                properties: ['page_id' => $event->lessonPageId, 'lesson_id' => $event->lessonId],
            ),

            $event instanceof QuestionAnswered => $this->recorder->record(
                eventKey: "question.answered:{$event->attemptId}",
                eventType: 'question_answered',
                userId: $event->userId,
                /* `is_correct` در `question_attempts` منبع حقیقت دارد و اینجا
                   تکرار نمی‌شود تا دو منبع واگرا نسازند. */
                properties: ['question_id' => $event->questionId],
            ),

            $event instanceof StudySessionRecorded => $this->recorder->record(
                eventKey: "study.session:{$event->studySessionId}",
                eventType: 'study_session_recorded',
                userId: $event->userId,
                properties: ['source' => $event->source, 'duration_sec' => $event->durationSeconds],
            ),

            /* `ProgressUpdated` رویداد تحلیلی **ثبت نمی‌کند** — فقط کش را باطل
               می‌کند (پایین‌تر). ثبت آن یعنی یک ردیف به‌ازای هر autosave صفحه،
               بدون هیچ مصرف‌کنندهٔ تحلیلی. */
            default => null,
        };

        /* هر رویداد کاربر-محور ⇒ کش تحلیل همان کاربر باطل می‌شود. */
        $userId = $this->userIdOf($event);

        if ($userId !== null) {
            $this->analytics->invalidate($userId);
        }
    }

    private function recordExamFinished(ExamFinished $event): void
    {
        $this->recorder->record(
            eventKey: "exam.finished:{$event->attemptId}",
            eventType: 'exam_finished',
            userId: $event->userId,
            /* ⚠️ `percentage` عمداً اینجا نیست: نمره در `exam_results` منبع حقیقت
               دارد و تکرارش در رویداد یعنی دو منبع که می‌توانند واگرا شوند. */
            properties: ['exam_id' => $event->examId, 'status' => $event->status, 'reason' => $event->submitReason],
        );
    }

    private function userIdOf(object $event): ?string
    {
        return match (true) {
            $event instanceof ExamStarted => $event->userId,
            $event instanceof ExamFinished => $event->userId,
            $event instanceof LessonCompleted => $event->userId,
            $event instanceof QuestionAnswered => $event->userId,
            $event instanceof StudySessionRecorded => $event->userId,
            $event instanceof ProgressUpdated => $event->userId,
            default => null,
        };
    }
}
