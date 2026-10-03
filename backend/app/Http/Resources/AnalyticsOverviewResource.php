<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * نمای کلی — شکل خروجی عیناً همان چیزی است که `OverviewAnalyticsService` می‌سازد.
 *
 * چرا Resource تقریباً pass-through: تعریف هر متریک در سرویس و در
 * `docs/analytics.md` یک‌جا است. بازنویسی فیلدها در Resource یعنی دو محل تعریف
 * که می‌توانند واگرا شوند — و «تعریف متریک» همان چیزی است که نباید دو بار باشد.
 */
class AnalyticsOverviewResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return (array) $this->resource;
    }
}
