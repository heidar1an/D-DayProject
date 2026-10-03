<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** عملکرد آزمون — تعریف متریک در `ExamAnalyticsService` و `docs/analytics.md`. */
class ExamAnalyticsResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return (array) $this->resource;
    }
}
