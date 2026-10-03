<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ناشر — نمای پنل (فاز ۱۷).
 *
 * تفاوت با Resource عمومی: `status`/`published_at`/`origin`/`legacy_id` می‌آیند.
 * ادمین برای مدیریت چرخهٔ عمر به این‌ها نیاز دارد. `legacy_id` فقط خواندنی است
 * و هیچ مسیری آن را نمی‌نویسد (نگاشت مهاجرت، نه دادهٔ دامنه).
 */
class AdminInternationalProviderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'slug' => $this->resource->slug,
            'name' => $this->resource->name,
            'name_en' => $this->resource->name_en,
            'kind' => $this->resource->kind,
            'country' => $this->resource->country,
            'founded' => $this->resource->founded,
            'description' => $this->resource->description,
            'focus' => $this->resource->focus ?? [],
            'logo_media_id' => $this->resource->logo_media_id,
            'sort_order' => (int) $this->resource->sort_order,
            'marquee_order' => (int) $this->resource->marquee_order,
            'status' => $this->resource->status,
            'origin' => $this->resource->origin,
            'legacy_id' => $this->resource->legacy_id,
            'published_at' => $this->resource->published_at?->toIso8601String(),
            'courses_count' => $this->whenCounted('courses'),
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'updated_at' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
