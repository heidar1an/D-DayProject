<?php

namespace App\Services\Exam;

use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamQuestion;
use Illuminate\Support\Collection;

/**
 * موتور تصحیح — **تنها جایی که نمره محاسبه می‌شود** (فاز ۷).
 *
 * Controller هیچ‌وقت grading نمی‌کند؛ این سرویس مستقل دامنه است و ورودی‌اش فقط
 * دادهٔ سرور است:
 *   • سؤال‌ها و کلیدها از `exam_questions` (Snapshot) — **نه** از بانک سؤال زنده؛
 *   • پاسخ‌ها از `exam_answers`;
 *   • سیاست از ستون‌های آزمون (`negative_marking`) — **نه** از بدنهٔ درخواست.
 *
 * فرمول عیناً همان فرمول legacy است (`gradeAttempt` در `examStore.js`) با یک
 * تعمیم که schema تحمیل می‌کند: وزن هر سؤال از Snapshot خوانده می‌شود.
 *   score      = Σ weight × (درست ? 1 : (نادرست ? negative_marking : 0))
 *   maxScore   = Σ weight
 *   percentage = clamp(round(score / maxScore × 1000) / 10, 0, 100)
 *
 * با `weight = 1` (که در این فاز همیشه هست) این دقیقاً به
 * `score = correct + wrong × negative` و `percentage = correct-ish / total`
 * legacy فرو می‌کاهد. فرمول تازه‌ای اختراع نشده.
 *
 * `teraz` (تراز) عمداً محاسبه نمی‌شود: در legacy خودش با کامنت «فرمول دموی» علامت
 * خورده و policy رسمی ندارد. ساختنش یعنی جعل یک قاعدهٔ کسب‌وکار.
 */
class ExamGrader
{
    /**
     * @param  Collection<int, ExamQuestion>  $examQuestions  مرتب بر `position`
     * @param  Collection<int, ExamAnswer>  $answers
     * @return array<string, mixed> مقادیر آمادهٔ درج در `exam_results`
     */
    public function grade(Exam $exam, ExamAttempt $attempt, Collection $examQuestions, Collection $answers): array
    {
        $byExamQuestion = $answers->keyBy('exam_question_id');
        $negative = (float) $exam->negative_marking;

        $weightedScore = 0.0;
        $maxScore = 0.0;
        $correct = 0;
        $wrong = 0;
        $blank = 0;
        $subjects = [];

        foreach ($examQuestions as $examQuestion) {
            $weight = (float) $examQuestion->weight;
            $maxScore += $weight;

            $subjectKey = $examQuestion->render_snapshot['subject']['slug']
                ?? $examQuestion->render_snapshot['subject']['title']
                ?? 'unknown';
            $subjectTitle = $examQuestion->render_snapshot['subject']['title'] ?? 'سایر';

            $subjects[$subjectKey] ??= [
                'subject' => $subjectTitle,
                'total' => 0,
                'correct' => 0,
                'wrong' => 0,
                'blank' => 0,
            ];
            $subjects[$subjectKey]['total']++;

            /** @var ExamAnswer|null $answer */
            $answer = $byExamQuestion->get($examQuestion->getKey());
            $selected = $answer?->selected_option_id;

            if ($selected === null) {
                /* بی‌پاسخ — نه امتیاز مثبت، نه جریمهٔ منفی. */
                $blank++;
                $subjects[$subjectKey]['blank']++;

                continue;
            }

            $correctOptionId = $examQuestion->correctOptionId();

            if ($correctOptionId !== null && $selected === $correctOptionId) {
                $correct++;
                $subjects[$subjectKey]['correct']++;
                $weightedScore += $weight;

                continue;
            }

            $wrong++;
            $subjects[$subjectKey]['wrong']++;
            $weightedScore += $weight * $negative;
        }

        $percentage = $maxScore > 0
            ? max(0.0, min(100.0, round(($weightedScore / $maxScore) * 1000) / 10))
            : 0.0;

        $breakdown = array_values(array_map(static function (array $row): array {
            $row['percent'] = $row['total'] > 0 ? (int) round(($row['correct'] / $row['total']) * 100) : 0;

            return $row;
        }, $subjects));

        usort($breakdown, static fn (array $a, array $b): int => $b['percent'] <=> $a['percent']);

        return [
            'score' => round($weightedScore, 3),
            'max_score' => round($maxScore, 3),
            'percentage' => $percentage,
            'correct_count' => $correct,
            'wrong_count' => $wrong,
            'blank_count' => $blank,
            'negative_marking' => $negative,
            'subject_breakdown' => $breakdown,
            'time_spent_sec' => $this->timeSpent($attempt, $exam),
        ];
    }

    /**
     * زمان صرف‌شده — از ساعت سرور، و هرگز بیشتر از مدت مجاز آزمون.
     *
     * همان clamp legacy (`Math.min(spent, duration * 60)`) تا Attempt ای که ساعت‌ها
     * باز مانده، عدد بی‌معنا تولید نکند.
     */
    private function timeSpent(ExamAttempt $attempt, Exam $exam): int
    {
        $end = $attempt->submitted_at ?? $attempt->graded_at ?? now();
        $spent = max(0, (int) $attempt->started_at->diffInSeconds($end));

        $limit = $attempt->started_at->diffInSeconds($attempt->deadline_at);
        $cap = (int) $exam->duration_minutes > 0
            ? min((int) $exam->duration_minutes * 60, (int) $limit)
            : (int) $limit;

        return min($spent, max($cap, 0));
    }
}
