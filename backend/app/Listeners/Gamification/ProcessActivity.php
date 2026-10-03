<?php

namespace App\Listeners\Gamification;

use App\Events\Exam\ExamFinished;
use App\Events\GreenPath\GreenPathStepCompleted;
use App\Events\Learning\LessonCompleted;
use App\Events\Learning\StudySessionRecorded;
use App\Events\QuestionBank\QuestionAnswered;
use App\Models\Challenge;
use App\Models\User;
use App\Models\XpTransaction;
use App\Services\Gamification\AchievementService;
use App\Services\Gamification\ChallengeService;
use App\Services\Gamification\StreakService;
use App\Services\Gamification\XpService;
use App\Services\Outbox\OutboxService;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * لولهٔ گیمیفیکیشن — فاز ۱۴.
 *
 *   User Action (existing domain service)
 *     → Validated Domain Event
 *     → این listener (بعد از commit)
 *     → Streak → XP (Rule) → Challenge → Achievement
 *
 *   1. **ShouldHandleEventsAfterCommit** — شکست گیمیفیکیشن هرگز تراکنش دامنه
 *      را برنمی‌گرداند و هیچ رخدادی قبل از نهایی‌شدن پاداش نمی‌گیرد.
 *   2. **Fail-soft** — خطا لاگ می‌شود و بلعیده می‌شود؛ مسیر کاربر نمی‌شکند.
 *   3. **Idempotent** — هر XP با request_key سرورساخت (`{type}:{id}`)؛ انتشار
 *      دوبارهٔ رویداد پاداش تکراری نمی‌سازد.
 */
class ProcessActivity implements ShouldHandleEventsAfterCommit
{
    public function __construct(
        private readonly StreakService $streaks,
        private readonly XpService $xp,
        private readonly ChallengeService $challenges,
        private readonly AchievementService $achievements,
        private readonly OutboxService $outbox,
    ) {}

    public function handle(object $event): void
    {
        try {
            $this->process($event);
        } catch (Throwable $error) {
            Log::warning('gamification.listener_failed', [
                'event' => $event::class,
                'error' => $error::class,
                'message' => $error->getMessage(),
                'at' => $error->getFile().':'.$error->getLine(),
            ]);
        }
    }

    private function process(object $event): void
    {
        if ($event instanceof LessonCompleted) {
            $this->apply($event->userId, XpTransaction::SOURCE_PAGE_COMPLETED, 'page:'.$event->lessonPageId, Challenge::METRIC_LESSONS_COMPLETED, 1);
        } elseif ($event instanceof QuestionAnswered) {
            if ($event->isCorrect) {
                $this->apply($event->userId, XpTransaction::SOURCE_QUESTION_CORRECT, 'attempt:'.$event->attemptId, Challenge::METRIC_QUESTIONS_CORRECT, 1);
            }
        } elseif ($event instanceof ExamFinished) {
            $this->apply($event->userId, XpTransaction::SOURCE_EXAM_FINISHED, 'attempt:'.$event->attemptId, Challenge::METRIC_EXAMS_FINISHED, 1);
        } elseif ($event instanceof StudySessionRecorded) {
            $min = (int) config('gamification.study_session.min_seconds_for_xp');
            $seconds = $event->durationSeconds ?? 0;

            /* نشست کوتاه/باز پاداش نمی‌گیرد ولی streak و دقیقهٔ مطالعه واقعی است. */
            if ($seconds >= $min) {
                $this->apply($event->userId, XpTransaction::SOURCE_STUDY_SESSION, 'session:'.$event->studySessionId, Challenge::METRIC_STUDY_MINUTES, max(1, (int) round($seconds / 60)));
            } else {
                $this->streaks->touch($event->userId);
            }
        } elseif ($event instanceof GreenPathStepCompleted) {
            /* قدم تکمیل‌شده فقط پیشرفت چالش می‌سازد — XP از رخداد یادگیری واقعی می‌آید. */
            $this->challenges->handleActivity($event->userId, Challenge::METRIC_STEPS_COMPLETED, 1);
            $this->notifyUnlockedAchievements($event->userId);
        }
    }

    private function apply(string $userId, string $sourceType, string $sourceId, string $metric, int $amount): void
    {
        $user = User::query()->find($userId);

        if ($user === null) {
            return;
        }

        $this->streaks->touch($userId);
        $this->xp->award($user, $sourceType, $sourceId);
        $this->challenges->handleActivity($userId, $metric, $amount);
        $this->notifyUnlockedAchievements($userId);
    }

    /**
     * نشان‌های تازه‌باز‌شده → Outbox → اعلان — فاز ۱۹.
     *
     * `event_key` از شناسهٔ نشان می‌آید، پس ارزیابی دوباره اعلان تکراری
     * نمی‌سازد (§27). خطا بلعیده می‌شود: اعلان Side Effect است، نه حقیقت دامنه.
     */
    private function notifyUnlockedAchievements(string $userId): void
    {
        foreach ($this->achievements->evaluateUnlocked($userId) as $achievement) {
            try {
                $this->outbox->record(
                    eventKey: 'notification.achievement_unlocked:'.$userId.':'.$achievement->getKey(),
                    aggregateType: 'achievement',
                    aggregateId: (string) $achievement->getKey(),
                    eventType: 'notification.achievement_unlocked',
                    payload: [
                        'userId' => $userId,
                        'entityId' => (string) $achievement->getKey(),
                        'title' => 'دستاورد تازه باز شد',
                        'body' => (string) $achievement->name,
                        'action' => '/dashboard/league',
                    ],
                );
            } catch (Throwable $error) {
                Log::warning('notification.achievement_outbox_failed', [
                    'achievement_id' => $achievement->getKey(),
                    'error' => $error::class,
                ]);
            }
        }
    }
}
