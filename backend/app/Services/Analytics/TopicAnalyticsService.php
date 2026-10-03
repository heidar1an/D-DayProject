<?php

namespace App\Services\Analytics;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * عملکرد موضوعی — فاز ۸.
 *
 * منبع: **`question_attempts` واقعی**، نه رویداد کلاینت.
 *
 * چرا نه `analytics_events`: `question_answered` یک رویداد جریانی است و ممکن است
 * دیر برسد یا (در سناریوی خرابی) نرسد. حقیقت تمرین در `question_attempts` است و
 * `is_correct` را سرور نوشته. Analytics فقط مصرف‌کننده است.
 *
 * مخرج کسر: `answered = correct + wrong`. سؤالِ بی‌پاسخ در `question_attempts`
 * رکوردی ندارد (چون Attempt فقط هنگام پاسخ ساخته می‌شود)، پس مخرج همان تعداد
 * پاسخ‌های واقعی است — نه تعداد سؤال‌های دیده‌شده.
 *
 * **`exam_answers` اینجا نمی‌آید.** عملکرد آزمون در `ExamAnalyticsService` است.
 * اگر این دو در یک مخرج جمع شوند، «دقت تمرین» با «دقت آزمون» مخلوط می‌شود و
 * کاربر عددی می‌بیند که هیچ‌کدام از دو سؤال را جواب نمی‌دهد.
 */
class TopicAnalyticsService
{
    /** @return array{topics: list<array<string, mixed>>, totals: array<string, mixed>} */
    public function build(User $user): array
    {
        $limit = (int) config('analytics.limits.max_topic_rows');

        $rows = DB::table('question_attempts as qa')
            ->join('questions as q', 'q.id', '=', 'qa.question_id')
            ->leftJoin('question_topics as t', 't.id', '=', 'q.topic_id')
            ->leftJoin('subjects as s', 's.id', '=', 'q.subject_id')
            ->where('qa.user_id', $user->getKey())
            ->groupBy('q.topic_id', 't.slug', 't.title', 's.slug', 's.title')
            ->selectRaw(
                'q.topic_id as topic_id, '
                .'t.slug as topic_slug, t.title as topic_title, '
                .'s.slug as subject_slug, s.title as subject_title, '
                .'count(*) as attempts, '
                .'sum(case when qa.is_correct then 1 else 0 end) as correct, '
                .'sum(case when qa.is_correct then 0 else 1 end) as wrong',
            )
            ->orderByDesc('attempts')
            ->limit($limit)
            ->get();

        $topics = $rows->map(static function ($row): array {
            $attempts = (int) $row->attempts;
            $correct = (int) $row->correct;

            return [
                'topic_id' => $row->topic_id,
                'topic_slug' => $row->topic_slug,
                'topic_title' => $row->topic_title ?? ($row->subject_title ?? 'نامشخص'),
                'subject_slug' => $row->subject_slug,
                'subject_title' => $row->subject_title,
                'attempts' => $attempts,
                'correct' => $correct,
                'wrong' => (int) $row->wrong,
                'accuracy' => $attempts > 0 ? round(($correct / $attempts) * 100, 1) : 0.0,
            ];
        })->all();

        $totalAttempts = array_sum(array_column($topics, 'attempts'));
        $totalCorrect = array_sum(array_column($topics, 'correct'));

        return [
            'topics' => $topics,
            'totals' => [
                'topics' => count($topics),
                'attempts' => $totalAttempts,
                'correct' => $totalCorrect,
                'accuracy' => $totalAttempts > 0 ? round(($totalCorrect / $totalAttempts) * 100, 1) : 0.0,
            ],
        ];
    }
}
