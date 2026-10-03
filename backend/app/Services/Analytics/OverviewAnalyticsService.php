<?php

namespace App\Services\Analytics;

use App\Models\ExamAttempt;
use App\Models\LearningProgress;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * نمای کلی تحلیلی کاربر — فاز ۸.
 *
 * **منبع هر عدد** (این جدول در `docs/analytics.md` هم ثبت شده):
 *
 * | شاخص                  | منبع                                        | تعریف دقیق |
 * |-----------------------|---------------------------------------------|-----------|
 * | `study.study_seconds` | `study_sessions.duration_sec`               | Σ مدت نشست‌های مطالعهٔ ثبت‌شده |
 * | `study.reading_seconds` | `learning_progress.seconds_spent`         | Σ زمان خواندن صفحهٔ درس |
 * | `learning.completed_pages` | `learning_progress.status='completed'` | تعداد صفحهٔ تکمیل‌شده |
 * | `learning.completed_lessons` | `learning_progress` ⨝ `lesson_pages` | تعداد **درسِ یکتا** با حداقل یک صفحهٔ تکمیل‌شده |
 * | `questions.*`         | `question_attempts`                         | تمرین مستقل (بانک سؤال) |
 * | `exams.*`             | `exam_results` (فقط released)               | عملکرد آزمون |
 *
 * ⚠️ **دو عدد مطالعه جمع نمی‌شوند.** `study_seconds` و `reading_seconds` دو
 * سنجهٔ مستقل‌اند؛ جمعشان یعنی دو‌بار‌شماری همان زمانی که هم در صفحهٔ درس و هم
 * در نشست مطالعه ثبت شده. گزارش جدا، تفسیر درست.
 *
 * ⚠️ **دقت تمرین ≠ دقت آزمون.** `questions.accuracy` فقط از `question_attempts`
 * است؛ `exam_answers` هرگز در مخرج آن نمی‌آید (§57/§58).
 */
class OverviewAnalyticsService
{
    public function build(User $user, ?Carbon $now = null): array
    {
        $now = $now ?? Carbon::now();
        $userId = $user->getKey();

        $progress = DB::table('learning_progress')
            ->where('user_id', $userId)
            ->selectRaw(
                'count(*) as tracked_pages, '
                .'sum(case when status = ? then 1 else 0 end) as completed_pages, '
                .'coalesce(sum(seconds_spent), 0) as reading_seconds',
                [LearningProgress::STATUS_COMPLETED],
            )
            ->first();

        $completedLessons = DB::table('learning_progress as lp')
            ->join('lesson_pages as pg', 'pg.id', '=', 'lp.lesson_page_id')
            ->where('lp.user_id', $userId)
            ->where('lp.status', LearningProgress::STATUS_COMPLETED)
            ->distinct()
            ->count('pg.lesson_id');

        $sessions = DB::table('study_sessions')
            ->where('user_id', $userId)
            ->selectRaw('count(*) as total, coalesce(sum(coalesce(duration_sec, 0)), 0) as seconds')
            ->first();

        $questions = DB::table('question_attempts')
            ->where('user_id', $userId)
            ->selectRaw(
                'count(*) as answered, '
                .'sum(case when is_correct then 1 else 0 end) as correct, '
                .'sum(case when is_correct then 0 else 1 end) as wrong',
            )
            ->first();

        $answered = (int) ($questions->answered ?? 0);
        $correct = (int) ($questions->correct ?? 0);

        $examAttempts = ExamAttempt::query()
            ->where('user_id', $userId)
            ->whereIn('status', [ExamAttempt::STATUS_GRADED, ExamAttempt::STATUS_EXPIRED])
            ->count();

        /*
         * نتیجهٔ منتشرنشده هرگز وارد تجمیع نمی‌شود — حتی برای صاحبش. دلیل:
         * عدد «میانگین نمرات» نباید پیش از انتشار کارنامه تغییر کند، وگرنه
         * کاربر می‌تواند از آن به نتیجهٔ خودش پی ببرد.
         */
        $results = DB::table('exam_results as r')
            ->join('exams as e', 'e.id', '=', 'r.exam_id')
            ->where('r.user_id', $userId)
            ->where(fn ($query) => $query
                ->whereNull('e.result_release_at')
                ->orWhere('e.result_release_at', '<=', $now))
            ->selectRaw('count(*) as graded, coalesce(avg(r.percentage), 0) as average, coalesce(max(r.percentage), 0) as highest')
            ->first();

        $recent = DB::table('analytics_events')
            ->where('user_id', $userId)
            ->orderByDesc('occurred_at')
            ->limit((int) config('analytics.limits.max_recent_activity'))
            ->get(['event_type', 'occurred_at', 'properties'])
            ->map(static fn ($row): array => [
                'event_type' => $row->event_type,
                'occurred_at' => (string) $row->occurred_at,
                'properties' => $row->properties === null ? null : json_decode((string) $row->properties, true),
            ])
            ->all();

        return [
            'study' => [
                'study_seconds' => (int) ($sessions->seconds ?? 0),
                'reading_seconds' => (int) ($progress->reading_seconds ?? 0),
                'study_sessions' => (int) ($sessions->total ?? 0),
                'tracked_pages' => (int) ($progress->tracked_pages ?? 0),
            ],
            'learning' => [
                'completed_pages' => (int) ($progress->completed_pages ?? 0),
                'completed_lessons' => $completedLessons,
            ],
            'questions' => [
                'answered' => $answered,
                'correct' => $correct,
                'wrong' => (int) ($questions->wrong ?? 0),
                'accuracy' => $answered > 0 ? round(($correct / $answered) * 100, 1) : 0.0,
            ],
            'exams' => [
                'attempts' => $examAttempts,
                'graded' => (int) ($results->graded ?? 0),
                'average_score' => round((float) ($results->average ?? 0), 1),
                'highest_score' => round((float) ($results->highest ?? 0), 1),
            ],
            'recent_activity' => $recent,
        ];
    }
}
