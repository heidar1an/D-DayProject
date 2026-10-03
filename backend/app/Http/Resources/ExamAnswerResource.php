<?php

namespace App\Http\Resources;

use App\Models\ExamAnswer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * پاسخ ثبت‌شده — **فقط** واقعیت قابل‌افشا.
 *
 * `is_correct` عمداً وجود ندارد: درستی پاسخ بخشی از کارنامه است و تا انتشار
 * نتیجه نباید از هیچ مسیری درز کند. اگر UI به «پاسخ داده‌ام/نداده‌ام» نیاز
 * دارد، `selected_option_id === null` کافی است.
 */
class ExamAnswerResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var ExamAnswer $answer */
        $answer = $this->resource;

        return [
            'exam_question_id' => $answer->exam_question_id,
            'selected_option_id' => $answer->selected_option_id,
            'revision' => (int) $answer->revision,
            'answered_at' => $answer->answered_at?->toIso8601String(),
        ];
    }
}
