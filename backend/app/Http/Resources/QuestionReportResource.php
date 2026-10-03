<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** گزارش ثبت‌شده. متن گزارش (`body`) برنمی‌گردد — کلاینت خودش فرستاده است. */
class QuestionReportResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $report = $this->resource;

        return [
            'id' => $report->getKey(),
            'question_id' => $report->question_id,
            'kind' => $report->kind,
            'status' => $report->status,
            'created_at' => $report->created_at?->toIso8601String(),
        ];
    }
}
