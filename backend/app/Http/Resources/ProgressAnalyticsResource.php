<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** پیشرفت و روند — تعریف متریک در `ProgressAnalyticsService` و `docs/analytics.md`. */
class ProgressAnalyticsResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return (array) $this->resource;
    }
}
