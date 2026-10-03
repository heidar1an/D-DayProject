<?php

namespace App\Http\Resources;

use App\Models\ExamQuestion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * سؤالِ snapshotشده برای دانشجو — **بدون کلید پاسخ**.
 *
 * خروجی مستقیماً از `render_snapshot` می‌آید، نه از بانک سؤال زنده. پس اگر ادمین
 * بعداً سؤال را ویرایش کند، Attempt در جریان همان چیزی را می‌بیند که snapshot شد.
 *
 * صریحاً وجود ندارد: `key_snapshot_encrypted`، `correct_option_id`، `explanation`.
 * تست `ExamAnswerKeyLeakTest` همین را قفل می‌کند.
 */
class ExamQuestionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var ExamQuestion $examQuestion */
        $examQuestion = $this->resource;
        $render = $examQuestion->render_snapshot;

        return [
            'exam_question_id' => $examQuestion->getKey(),
            'position' => (int) $examQuestion->position,
            'question_id' => $render['question_id'] ?? null,
            'stem' => $render['stem'] ?? '',
            'figure_key' => $render['figure_key'] ?? null,
            'type' => $render['type'] ?? null,
            'difficulty' => $render['difficulty'] ?? null,
            'subject' => $render['subject'] ?? null,
            'topic' => $render['topic'] ?? null,
            'options' => array_map(static fn (array $option): array => [
                'id' => $option['id'],
                'position' => $option['position'],
                'label' => $option['label'] ?? null,
                'body' => $option['body'],
            ], $render['options'] ?? []),
        ];
    }
}
