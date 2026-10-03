<?php

namespace App\Services\Exam;

use App\Exceptions\ApiErrorException;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamQuestion;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * کارنامه و مرور — فاز ۷.
 *
 * دو تصمیم امنیتی که اینجا اعمال می‌شوند و هیچ‌جای دیگری قابل دور زدن نیستند:
 *
 *   1. **Result Release** — پیش از `result_release_at` هیچ عددی افشا نمی‌شود.
 *      پاسخ فقط `{state: 'processing', release_at}` است. کلاینت نمی‌تواند با
 *      دستکاری ساعت یا پارامتر، زودتر کارنامه را ببیند.
 *
 *   2. **Answer Review** — کلید پاسخ تنها وقتی برمی‌گردد که:
 *      نتیجه released باشد، `rules.allow_review` روشن باشد، Attempt تمام‌شده و
 *      متعلق به همین کاربر باشد. در غیر این صورت فقط وضعیت و پاسخ انتخابی.
 *
 * مالکیت: عدم مالکیت ⇒ ۴۰۴ (وجود Attempt کاربر دیگر لو نمی‌رود).
 */
class ExamResultService
{
    public function __construct(
        private readonly ExamQueryService $exams,
        private readonly ExamPhaseResolver $phases,
    ) {}

    /**
     * کارنامهٔ یک Attempt — ماشین وضعیت `ready | processing | not_participated`.
     *
     * @return array<string, mixed>
     */
    public function result(User $user, string $attemptId, ?CarbonInterface $now = null): array
    {
        $now = $now ?? Carbon::now();
        $attempt = $this->ownedFinishedAttempt($user, $attemptId);
        $exam = $attempt->exam;

        if (! $this->phases->released($exam, $now)) {
            return [
                'state' => 'processing',
                'release_at' => $exam->result_release_at?->toIso8601String(),
                'attempt_id' => $attempt->getKey(),
                'exam_id' => $exam->getKey(),
            ];
        }

        $result = $attempt->result;

        if ($result === null) {
            /* Attempt بستهٔ بدون نتیجه (نظیر کرش بین submit و persist) — نباید رخ دهد،
               ولی افشای «نتیجه نیست» بهتر از جعل عدد است. */
            return [
                'state' => 'not_participated',
                'attempt_id' => $attempt->getKey(),
                'exam_id' => $exam->getKey(),
            ];
        }

        return [
            'state' => 'ready',
            'attempt' => $attempt,
            'result' => $result,
        ];
    }

    /**
     * مرور سؤال‌های آزمون پس از پایان.
     *
     * @return array<string, mixed>
     */
    public function review(User $user, string $attemptId, ?CarbonInterface $now = null): array
    {
        $now = $now ?? Carbon::now();
        $attempt = $this->ownedFinishedAttempt($user, $attemptId);
        $exam = $attempt->exam;

        $rules = ExamRules::fromArray(is_array($exam->rules) ? $exam->rules : []);

        if (! $rules->allowsReview()) {
            throw new ApiErrorException('REVIEW_NOT_ALLOWED', 403, 'Reviewing this exam is not allowed.');
        }

        if (! $this->phases->released($exam, $now)) {
            throw new ApiErrorException('RESULT_NOT_RELEASED', 409, 'The answer key is not released yet.');
        }

        $answers = ExamAnswer::query()
            ->where('attempt_id', $attempt->getKey())
            ->get()
            ->keyBy('exam_question_id');

        $questions = ExamQuestion::query()
            ->where('exam_id', $exam->getKey())
            ->orderBy('position')
            ->get();

        return [
            'attempt' => $attempt,
            'questions' => $questions,
            'answers' => $answers,
        ];
    }

    /** Attempt تمام‌شدهٔ کاربر، یا ۴۰۴/۴۰۹. */
    public function ownedFinishedAttempt(User $user, string $attemptId): ExamAttempt
    {
        $attempt = ExamAttempt::query()
            ->where('id', $attemptId)
            ->where('user_id', $user->getKey())
            ->first();

        if ($attempt === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Exam attempt not found.');
        }

        if (! $attempt->isFinished()) {
            throw new ApiErrorException('ATTEMPT_NOT_FINISHED', 409, 'This attempt has not been finished yet.');
        }

        return $attempt;
    }
}
