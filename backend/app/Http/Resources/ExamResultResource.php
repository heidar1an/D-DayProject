<?php

namespace App\Http\Resources;

use App\Models\ExamResult;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * کارنامه — همهٔ اعداد **سرور-مشتق** از `ExamGrader`.
 *
 * `teraz` (تراز) عمداً `null` است: فرمول legacy (`4200 + percentage × 53`) خودش
 * با کامنت «فرمول دموی» علامت خورده و policy رسمی ندارد. کلید برای سازگاری شکل
 * پاسخ حفظ شده تا کلاینت مجبور به شاخه‌بندی نشود، ولی هیچ عدد ساختگی تولید نمی‌شود.
 *
 * `community` (توزیع جامعه) هم اینجا نیست: نسخهٔ legacy آن توزیع **مصنوعی** می‌ساخت.
 * دادهٔ تجمیعی واقعی از `GET /api/v1/exams/{id}/ranking` می‌آید.
 */
class ExamResultResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var ExamResult $result */
        $result = $this->resource;

        return [
            'id' => $result->getKey(),
            'attempt_id' => $result->attempt_id,
            'exam_id' => $result->exam_id,
            'submit_reason' => $result->submit_reason,
            'score' => (float) $result->score,
            'max_score' => (float) $result->max_score,
            'percentage' => (float) $result->percentage,
            'correct_count' => (int) $result->correct_count,
            'wrong_count' => (int) $result->wrong_count,
            'blank_count' => (int) $result->blank_count,
            'negative_marking' => (float) $result->negative_marking,
            'time_spent_sec' => (int) $result->time_spent_sec,
            'subject_breakdown' => $result->subject_breakdown ?? [],
            'teraz' => null,
            'graded_at' => $result->graded_at?->toIso8601String(),
        ];
    }
}
