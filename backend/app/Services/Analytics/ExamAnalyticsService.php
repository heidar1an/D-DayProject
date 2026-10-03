<?php

namespace App\Services\Analytics;

use App\Models\ExamAttempt;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * عملکرد آزمون — فاز ۸.
 *
 * منبع: `exam_attempts` + `exam_results` + `exams`. **نه** `analytics_events`.
 *
 * دو قاعدهٔ سخت:
 *
 *   1. **نتیجهٔ منتشرنشده هرگز وارد تجمیع نمی‌شود** — نه در میانگین، نه در
 *      «اخیر». شرط release در **همهٔ** Query ها تکرار می‌شود، نه یک‌جا.
 *
 *   2. **`question_attempts` اینجا نمی‌آید.** دقت آزمون از شمارش‌های
 *      `exam_results` است (`correct/(correct+wrong+blank)`)، نه از تمرین مستقل.
 *
 * عملکرد موضوعی (`subjects`) از `exam_results.subject_breakdown` خوانده می‌شود که
 * `ExamGrader` در زمان تصحیح ساخته — نه با رمزگشایی دوبارهٔ کلیدها. هم ارزان‌تر
 * است، هم یک منبع واحد برای عدد نمره و عدد موضوعی می‌سازد.
 */
class ExamAnalyticsService
{
    public function build(User $user, ?Carbon $now = null): array
    {
        $now = $now ?? Carbon::now();
        $userId = $user->getKey();

        $released = fn ($query) => $query
            ->whereNull('e.result_release_at')
            ->orWhere('e.result_release_at', '<=', $now);

        $totals = DB::table('exam_results as r')
            ->join('exams as e', 'e.id', '=', 'r.exam_id')
            ->where('r.user_id', $userId)
            ->where($released)
            ->selectRaw(
                'count(*) as graded, '
                .'coalesce(avg(r.percentage), 0) as average_score, '
                .'coalesce(max(r.percentage), 0) as highest_score, '
                .'coalesce(sum(r.correct_count), 0) as correct, '
                .'coalesce(sum(r.wrong_count), 0) as wrong, '
                .'coalesce(sum(r.blank_count), 0) as blank',
            )
            ->first();

        $attempts = ExamAttempt::query()
            ->where('user_id', $userId)
            ->whereIn('status', [ExamAttempt::STATUS_GRADED, ExamAttempt::STATUS_EXPIRED])
            ->count();

        $correct = (int) ($totals->correct ?? 0);
        $wrong = (int) ($totals->wrong ?? 0);
        $blank = (int) ($totals->blank ?? 0);
        $gradedItems = $correct + $wrong + $blank;

        $recent = DB::table('exam_results as r')
            ->join('exams as e', 'e.id', '=', 'r.exam_id')
            ->where('r.user_id', $userId)
            ->where($released)
            ->orderByDesc('r.graded_at')
            ->limit((int) config('analytics.limits.max_recent_results'))
            ->get([
                'r.id as result_id', 'r.exam_id', 'e.slug as exam_slug', 'e.title as exam_title',
                'r.percentage', 'r.correct_count', 'r.wrong_count', 'r.blank_count',
                'r.time_spent_sec', 'r.submit_reason', 'r.graded_at',
            ])
            ->map(static fn ($row): array => [
                'result_id' => $row->result_id,
                'exam_id' => $row->exam_id,
                'exam_slug' => $row->exam_slug,
                'exam_title' => $row->exam_title,
                'percentage' => (float) $row->percentage,
                'correct_count' => (int) $row->correct_count,
                'wrong_count' => (int) $row->wrong_count,
                'blank_count' => (int) $row->blank_count,
                'time_spent_sec' => (int) $row->time_spent_sec,
                'submit_reason' => $row->submit_reason,
                'graded_at' => (string) $row->graded_at,
            ])
            ->all();

        return [
            'totals' => [
                'attempts' => $attempts,
                'graded' => (int) ($totals->graded ?? 0),
                'average_score' => round((float) ($totals->average_score ?? 0), 1),
                'highest_score' => round((float) ($totals->highest_score ?? 0), 1),
                /* «دقت آزمون» — مخرجش فقط پاسخ‌های آزمون است، نه تمرین مستقل. */
                'accuracy' => $gradedItems > 0 ? round(($correct / $gradedItems) * 100, 1) : 0.0,
            ],
            'subjects' => $this->subjectPerformance($userId, $now),
            'recent' => $recent,
        ];
    }

    /**
     * عملکرد درس‌محور — تجمیع `subject_breakdown` روی نتایج منتشرشده.
     *
     * @return list<array<string, mixed>>
     */
    private function subjectPerformance(string $userId, Carbon $now): array
    {
        $rows = DB::table('exam_results as r')
            ->join('exams as e', 'e.id', '=', 'r.exam_id')
            ->where('r.user_id', $userId)
            ->where(fn ($query) => $query
                ->whereNull('e.result_release_at')
                ->orWhere('e.result_release_at', '<=', $now))
            ->pluck('r.subject_breakdown');

        $totals = [];

        foreach ($rows as $raw) {
            $breakdown = is_string($raw) ? json_decode($raw, true) : $raw;

            if (! is_array($breakdown)) {
                continue;
            }

            foreach ($breakdown as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $subject = (string) ($row['subject'] ?? 'سایر');
                $totals[$subject] ??= ['subject' => $subject, 'total' => 0, 'correct' => 0, 'wrong' => 0, 'blank' => 0];

                foreach (['total', 'correct', 'wrong', 'blank'] as $key) {
                    $totals[$subject][$key] += (int) ($row[$key] ?? 0);
                }
            }
        }

        $subjects = array_values(array_map(static function (array $row): array {
            $row['accuracy'] = $row['total'] > 0 ? round(($row['correct'] / $row['total']) * 100, 1) : 0.0;

            return $row;
        }, $totals));

        usort($subjects, static fn (array $a, array $b): int => $b['accuracy'] <=> $a['accuracy']);

        return $subjects;
    }
}
