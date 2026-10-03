<?php

namespace App\Http\Requests\Exam;

use App\Http\Requests\ApiFormRequest;

/**
 * ثبت پاسخ در Attempt.
 *
 * **فقط سه واقعیت:** کدام سؤال، کدام گزینه، و نسخهٔ قبلی.
 *
 * فهرست فیلدهای ممنوع که در این کلاس هیچ قاعده‌ای ندارند (پس به `validated()`
 * راه نمی‌یابند و اگر کسی بفرستد بی‌اثر است):
 * `score`, `isCorrect`, `correctAnswer`, `correctOptionId`, `negativeMarking`,
 * `questionVersion`, `result`, `userId`, `attemptId`, `weight`.
 *
 * `questionId` شناسهٔ سؤال **در این آزمون** است (`exam_question_id` از پاسخ
 * `GET /api/v1/exam-attempts/{id}`)، نه شناسهٔ سؤال در بانک سؤال. دلیل: گزینه‌ها
 * متعلق به Snapshot اند و اعتبارسنجی «گزینه به همین سؤال تعلق دارد» باید روی
 * همان Snapshot انجام شود.
 *
 * `revision` قفل خوش‌بینانه است: `0` یعنی «هنوز پاسخی ثبت نشده». عدم تطابق ⇒ ۴۰۹.
 */
class SaveExamAnswerRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'questionId' => ['required', 'uuid'],
            // null مجاز است = «پاسخ را پاک کن» (legacy: delta با مقدار null).
            'selectedOptionId' => ['present', 'nullable', 'string', 'max:64'],
            'revision' => ['required', 'integer', 'min:0'],
            'timeSpent' => ['nullable', 'integer', 'min:0', 'max:86400'],
        ];
    }
}
