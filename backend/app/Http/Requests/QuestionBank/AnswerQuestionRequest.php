<?php

namespace App\Http\Requests\QuestionBank;

use App\Http\Requests\ApiFormRequest;

/**
 * پاسخ به سؤال.
 *
 * **فقط واقعیت:** کدام گزینه انتخاب شد. فهرست فیلدهای ممنوع که در این کلاس
 * هیچ قاعده‌ای ندارند (پس به `validated()` راه نمی‌یابند):
 * `isCorrect`, `correctAnswer`, `correctOptionId`, `score`, `negativeMarking`,
 * `xp`, `heartReward`, `reward`, `answeredAt`.
 *
 * `attemptKey` کلید idempotency است: double-click و retry شبکه Attempt دوم
 * نمی‌سازند. اگر همان کلید با payload متفاوت بیاید ⇒ ۴۰۹.
 */
class AnswerQuestionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // null مجاز است = «بدون پاسخ» ثبت می‌شود (is_correct=false)، نه خطا.
            'selectedOptionId' => ['present', 'nullable', 'uuid'],
            'attemptKey' => ['nullable', 'string', 'max:96'],
            'timeSpent' => ['nullable', 'integer', 'min:0', 'max:'.(int) config('question_bank.attempts.max_time_spent_seconds')],
        ];
    }
}
