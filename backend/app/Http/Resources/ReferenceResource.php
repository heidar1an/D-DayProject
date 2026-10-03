<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Reference عمومی — فاز ۱۵. هیچ status/version داخلیِ مدیریتی serialize نمی‌شود
 * (§13؛ قاعدهٔ API پروژه: دادهٔ داخلی غیرضروری بیرون نمی‌آید).
 *
 * @property \App\Models\Reference $resource
 */
final class ReferenceResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'slug' => $this->resource->slug,
            'title' => $this->resource->title,
            'description' => $this->resource->description,
            'sections' => $this->resource->sections ?? [],
            'chapterCount' => is_array($this->resource->sections) ? count($this->resource->sections) : 0,
            'assets' => $this->additional['assets'] ?? (object) [],
            'publishedAt' => $this->resource->published_at?->toIso8601String(),
            'updatedAt' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
