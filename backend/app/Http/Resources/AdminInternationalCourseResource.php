<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * دورهٔ بین‌الملل — نمای پنل (فاز ۱۷).
 *
 * `status`/`published_at`/`origin`/`legacy_id` می‌آیند؛ ادمین برای مدیریت
 * چرخهٔ عمر به آن‌ها نیاز دارد. `required_capability` هم می‌آید چون انتخاب
 * «رایگان یا پرمیوم» بخشی از فرم پنل است.
 */
class AdminInternationalCourseResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'slug' => $this->resource->slug,
            'title' => $this->resource->title,
            'description' => $this->resource->description,
            'category' => $this->resource->category,
            'level' => $this->resource->level,
            'tags' => $this->resource->tags ?? [],
            'cover_media_id' => $this->resource->cover_media_id,
            'accent' => $this->resource->accent,
            'accent_soft' => $this->resource->accent_soft,
            'badge' => $this->resource->badge,
            'duration_minutes' => $this->resource->duration_minutes,
            'total_duration_label' => $this->resource->total_duration_label,
            'required_capability' => $this->resource->required_capability,
            'sort_order' => (int) $this->resource->sort_order,
            'status' => $this->resource->status,
            'origin' => $this->resource->origin,
            'legacy_id' => $this->resource->legacy_id,
            'published_at' => $this->resource->published_at?->toIso8601String(),
            'provider' => new AdminInternationalProviderResource($this->whenLoaded('provider')),
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'updated_at' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
