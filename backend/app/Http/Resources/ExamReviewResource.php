<?php

namespace App\Http\Resources;

use App\Models\ExamAnswer;
use App\Models\ExamQuestion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مرور پس از آزمون — **تنها مسیری که کلید پاسخ از سرور بیرون می‌رود**.
 *
 * این Resource عمداً از `ExamQuestionResource` جدا است: کلید در یک کلاس دیگر
 * قرار دارد تا «فراموش کردن یک شرط» نتواند به‌طور تصادفی کلید را در مسیر عادی
 * (سؤال‌های در جریان آزمون) لو بدهد.
 *
 * پیش‌شرط‌های رسیدن به اینجا (همه در `ExamResultService::review` اعمال می‌شوند):
 *   1. Attempt متعلق به همین کاربر باشد (۴۰۴ در غیر این صورت)؛
 *   2. Attempt تمام‌شده باشد (۴۰۹)؛
 *   3. `rules.allow_review` روشن باشد (۴۰۳)؛
 *   4. نتیجه released شده باشد (۴۰۹).
 */
class ExamReviewResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array{question: ExamQuestion, answer: ?ExamAnswer} $payload */
        $payload = $this->resource;

        $question = $payload['question'];
        $answer = $payload['answer'];
        $render = $question->render_snapshot;
        $key = $question->keySnapshot();
        $correctOptionId = $question->correctOptionId();
        $selectedOptionId = $answer?->selected_option_id;

        $options = array_map(static fn (array $option): array => [
            'id' => $option['id'],
            'position' => $option['position'],
            'label' => $option['label'] ?? null,
            'body' => $option['body'],
            'is_correct' => $correctOptionId !== null && $option['id'] === $correctOptionId,
            'is_selected' => $selectedOptionId !== null && $option['id'] === $selectedOptionId,
        ], $render['options'] ?? []);

        return [
            'exam_question_id' => $question->getKey(),
            'position' => (int) $question->position,
            'stem' => $render['stem'] ?? '',
            'figure_key' => $render['figure_key'] ?? null,
            'subject' => $render['subject'] ?? null,
            'topic' => $render['topic'] ?? null,
            'options' => $options,
            'selected_option_id' => $selectedOptionId,
            'correct_option_id' => $correctOptionId,
            'is_correct' => $selectedOptionId !== null && $selectedOptionId === $correctOptionId,
            'explanation' => is_array($key) ? ($key['explanation'] ?? null) : null,
        ];
    }
}
