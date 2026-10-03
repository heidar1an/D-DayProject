<?php

namespace App\Services\QuestionBank;

use App\Events\QuestionBank\QuestionAnswered;
use App\Exceptions\ApiErrorException;
use App\Models\Question;
use App\Models\QuestionAttempt;
use App\Models\QuestionKey;
use App\Models\User;
use App\Services\Support\IdempotencyService;
use App\Support\Idempotency\IdempotencyOutcome;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * تصحیح سمت سرور — تنها نویسندهٔ `question_attempts`.
 *
 * مرز اعتماد (همان قاعدهٔ legacy، سخت‌گیرانه‌تر):
 *     کلاینت می‌گوید:     «گزینهٔ X را انتخاب کردم»
 *     سرور تعیین می‌کند:   «X درست است یا نه»
 *     سرور تصمیم می‌گیرد:  «پاداش = ۱ قلب»
 *
 * چه چیزی از کلاینت **پذیرفته نمی‌شود**: `isCorrect`, `correctAnswer`, `score`,
 * `negativeMarking`, `xp`, `heartReward`, `answeredAt`. هیچ‌کدام در rules
 * درخواست نیستند، پس به `validated()` راه ندارند.
 *
 * Flow دقیق: سؤال منتشرشده → گزینه‌ها → کلید → اعتبارسنجی تعلق گزینه به سؤال →
 * مقایسه → ساخت Attempt → پاداش → بازگشایی مجاز.
 *
 * پاداش در **همان تراکنش** با Attempt ساخته می‌شود؛ اگر روزی side-effect سنگین
 * شد، جای درستش Outbox/afterCommit است (فاز ۱۶) نه این فاز.
 */
class QuestionGradingService
{
    public function __construct(
        private readonly HeartRewardService $hearts,
        private readonly QuestionRevealService $reveal,
        private readonly IdempotencyService $idempotency,
    ) {}

    /**
     * @param  array{selectedOptionId?: string|null, timeSpent?: int}  $data
     * @param  Closure(array<string, mixed>):array<string, mixed>  $present
     */
    public function answer(User $user, string $questionId, array $data, ?string $attemptKey, Closure $present): IdempotencyOutcome
    {
        $question = Question::query()
            ->where('id', $questionId)
            ->with(['options', 'key'])
            ->first();

        // سؤال پیش‌نویس/آرشیوشده هم ۴۰۴ می‌گیرد: وجودش نباید لو برود.
        if ($question === null || Gate::forUser($user)->denies('answer', $question)) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Question not found.');
        }

        $selectedOptionId = $data['selectedOptionId'] ?? null;

        return $this->idempotency->once(
            scope: 'question_bank.answer',
            actorKey: 'user:'.$user->getKey(),
            requestKey: $attemptKey,
            requestPayload: [
                'question_id' => $question->getKey(),
                'selected_option_id' => $selectedOptionId,
                'time_spent' => (int) ($data['timeSpent'] ?? 0),
            ],
            callback: fn (): IdempotencyOutcome => $this->apply($user, $question, $data, $present),
        );
    }

    /** @param Closure(array<string, mixed>):array<string, mixed> $present */
    private function apply(User $user, Question $question, array $data, Closure $present): IdempotencyOutcome
    {
        $key = $question->key;

        if (! $key instanceof QuestionKey) {
            // سؤال منتشرشده بدون کلید = خطای محتوا، نه خطای کاربر.
            throw new ApiErrorException('QUESTION_NOT_GRADABLE', 409, 'This question has no answer key yet.');
        }

        $selectedOptionId = $data['selectedOptionId'] ?? null;

        if ($selectedOptionId !== null && ! $this->optionBelongsTo($question, (string) $selectedOptionId)) {
            throw new ApiErrorException(
                'OPTION_NOT_IN_QUESTION',
                422,
                'The selected option does not belong to this question.',
                ['selectedOptionId' => ['OPTION_NOT_IN_QUESTION']],
            );
        }

        $isCorrect = $selectedOptionId !== null
            && (string) $selectedOptionId === (string) $key->correct_option_id;

        // سقف زمانی پاسخ: مقدار کلاینت فقط «توصیفی» است و clamp می‌شود.
        $timeSpent = min(
            (int) config('question_bank.attempts.max_time_spent_seconds'),
            max(0, (int) ($data['timeSpent'] ?? 0)),
        );

        $result = DB::transaction(function () use ($user, $question, $selectedOptionId, $isCorrect, $timeSpent): array {
            $attempt = new QuestionAttempt;
            $attempt->forceFill([
                'user_id' => $user->getKey(),
                'guest_id' => null,
                'question_id' => $question->getKey(),
                'selected_option_id' => $selectedOptionId,
                'is_correct' => $isCorrect,
                'question_version' => $question->version,
                'time_spent_sec' => $timeSpent,
                // زمان پاسخ از ساعت **سرور** می‌آید؛ `answeredAt` کلاینت خوانده نمی‌شود.
                'answered_at' => now(),
            ])->save();

            $reward = $this->hearts->awardFor($user, $attempt);

            return ['attempt' => $attempt, 'reward' => $reward];
        });

        /** @var QuestionAttempt $attempt */
        $attempt = $result['attempt'];

        QuestionAnswered::dispatch(
            $user->getKey(),
            $question->getKey(),
            $attempt->getKey(),
            $attempt->is_correct,
        );

        $payload = $present([
            'attempt' => $attempt,
            'question' => $question,
            'reward' => $result['reward'],
            'reveal' => $this->reveal->revealAfterAnswer($question, $key),
        ]);

        return new IdempotencyOutcome(false, 201, $payload);
    }

    private function optionBelongsTo(Question $question, string $optionId): bool
    {
        return $question->options->contains(fn ($option) => (string) $option->getKey() === $optionId);
    }
}
