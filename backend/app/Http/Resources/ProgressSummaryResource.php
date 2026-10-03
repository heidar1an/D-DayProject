<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * خلاصهٔ پیشرفت کاربر.
 *
 * این یک aggregate **مشتق** است: از `learning_progress` و `study_sessions`
 * محاسبه می‌شود و در هیچ ستونی ذخیره نمی‌شود (قاعدهٔ Blueprint §4: aggregate
 * hardcoded ممنوع، مگر نیاز واقعی اثبات شود).
 */
class ProgressSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array{totals: array<string,int>, courses: list<array<string,mixed>>} $summary */
        $summary = $this->resource;

        return [
            'totals' => $summary['totals'],
            'courses' => $summary['courses'],
        ];
    }
}
