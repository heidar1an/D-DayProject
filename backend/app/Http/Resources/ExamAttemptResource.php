<?php

namespace App\Http\Resources;

use App\Models\ExamAttempt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Attempt آزمون برای مالکش.
 *
 * صریحاً وجود ندارد: `user_id` (کلاینت نباید هویت خودش را از پاسخ بخواند و
 * هیچ‌جای UI به آن نیاز ندارد)، `submit_key`، `version` و هیچ عدد نمره‌ای.
 * نمره فقط از `ExamResultResource` و پس از انتشار می‌آید.
 */
class ExamAttemptResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var ExamAttempt $attempt */
        $attempt = $this->resource;

        return [
            'id' => $attempt->getKey(),
            'exam_id' => $attempt->exam_id,
            'attempt_no' => (int) $attempt->attempt_no,
            'status' => $attempt->status,
            'started_at' => $attempt->started_at?->toIso8601String(),
            /* مهلت **سرور-محاسبه‌شده** است؛ تایمر کلاینت فقط نمایش آن است. */
            'deadline_at' => $attempt->deadline_at?->toIso8601String(),
            'submitted_at' => $attempt->submitted_at?->toIso8601String(),
            'submit_reason' => $attempt->submit_reason,
            'answered_count' => $this->answeredCount($attempt),
            'has_result' => $attempt->result !== null,
        ];
    }

    private function answeredCount(ExamAttempt $attempt): int
    {
        if ($attempt->relationLoaded('answers')) {
            return $attempt->answers->whereNotNull('selected_option_id')->count();
        }

        return (int) $attempt->answers()->whereNotNull('selected_option_id')->count();
    }
}
