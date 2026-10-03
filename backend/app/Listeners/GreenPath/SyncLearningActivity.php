<?php

namespace App\Listeners\GreenPath;

use App\Events\Exam\ExamFinished;
use App\Events\Learning\LessonCompleted;
use App\Events\QuestionBank\QuestionAnswered;
use App\Services\GreenPath\GreenPathService;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * همگام‌سازی مسیر سبز با رخدادهای واقعی یادگیری — فاز ۱۳.
 *
 * جهت جریان همان مرز معماری است:
 *     Learning Action → Progress/Exam/Question → Event → Green Path
 * نه برعکس. هیچ completion جعلی از مسیر سبز به پیشرفت تزریق نمی‌شود.
 *
 * After-commit و fail-soft است: شکست همگام‌سازی هرگز ثبت پیشرفت را برنمی‌گرداند.
 */
class SyncLearningActivity implements ShouldHandleEventsAfterCommit
{
    public function __construct(
        private readonly GreenPathService $greenPath,
    ) {}

    public function handle(object $event): void
    {
        try {
            if ($event instanceof LessonCompleted) {
                $this->greenPath->completeLessonSteps($event->userId, $event->lessonId);
            } elseif ($event instanceof ExamFinished) {
                $this->greenPath->completeExamSteps($event->userId, $event->examId);
            } elseif ($event instanceof QuestionAnswered) {
                if ($event->isCorrect) {
                    $this->greenPath->completeQuestionSteps($event->userId, $event->questionId);
                }
            }
        } catch (Throwable $error) {
            Log::warning('green_path.sync_failed', [
                'event' => $event::class,
                'error' => $error::class,
            ]);
        }
    }
}
