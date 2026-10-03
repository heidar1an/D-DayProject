<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** عملکرد موضوعی — تعریف متریک در `TopicAnalyticsService` و `docs/analytics.md`. */
class TopicAnalyticsResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return (array) $this->resource;
    }
}
