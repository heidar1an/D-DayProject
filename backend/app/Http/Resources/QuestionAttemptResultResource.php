<?php

namespace App\Http\Resources;

use App\Models\QuestionAttempt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * نتیجهٔ پاسخ.
 *
 * فقط دادهٔ مجاز: شناسهٔ تلاش، گزینهٔ انتخابی، درستی، زمان پاسخ، پاداش گرفته‌شده
 * و **بازگشایی پس از ثبت** (`correct_option_id` + `explanation`).
 *
 * `reveal` تنها پس از یک Attempt موفق ساخته می‌شود؛ در فهرست سؤال هیچ‌وقت حاضر
 * نیست. اگر `QUESTION_BANK_REVEAL_AFTER_ANSWER=false` شود، `reveal` برابر null
 * می‌ماند و کلید به کلاینت نمی‌رسد.
 */
class QuestionAttemptResultResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array{attempt: QuestionAttempt, reward: array{awarded: bool, amount: int}, reveal: array<string,mixed>|null} $payload */
        $payload = $this->resource;
        $attempt = $payload['attempt'];
        $reward = $payload['reward'];
        $reveal = $payload['reveal'];

        return [
            'attempt_id' => $attempt->getKey(),
            'question_id' => $attempt->question_id,
            'question_version' => (int) $attempt->question_version,
            'selected_option_id' => $attempt->selected_option_id,
            'is_correct' => (bool) $attempt->is_correct,
            'answered_at' => $attempt->answered_at?->toIso8601String(),
            'reward' => [
                'awarded' => (bool) $reward['awarded'],
                'amount' => (int) $reward['amount'],
            ],
            'reveal' => $reveal === null ? null : [
                'correct_option_id' => $reveal['correct_option_id'],
                'explanation' => $reveal['explanation'],
            ],
        ];
    }
}
