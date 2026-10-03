<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل عمومی دورهٔ بین‌الملل — فاز ۱۷.
 *
 * `required_capability` و `locked` هر دو می‌آیند: UI باید بداند دوره پرمیوم است
 * و **چرا** قفل است. اما محتوای قفل‌شده‌ای وجود ندارد که لو برود — این موجودیت
 * فقط کاتالوگ است؛ محتوای آموزشی مالکیت Content Engine است.
 *
 * `status`/`origin`/`legacy_id` عمداً نیستند (enumeration و مهاجرت).
 */
class InternationalCourseResource extends JsonResource
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
            'cover_url' => $this->coverUrl(),
            'accent' => $this->resource->accent,
            'accent_soft' => $this->resource->accent_soft,
            'badge' => $this->resource->badge,
            'duration_minutes' => $this->resource->duration_minutes,
            'total_duration_label' => $this->resource->total_duration_label,
            'required_capability' => $this->resource->required_capability,
            'locked' => (bool) ($this->additional['locked'] ?? false),
            'sort_order' => (int) $this->resource->sort_order,
            'provider' => new InternationalProviderResource($this->whenLoaded('provider')),
        ];
    }

    private function coverUrl(): ?string
    {
        return $this->resource->cover_media_id === null
            ? null
            : '/api/v1/media/'.$this->resource->cover_media_id.'/stream';
    }
}
