<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * خلاصهٔ مقاله عمومی — فاز ۱۶. status/version/author serialize نمی‌شود (§13).
 *
 * @property \App\Models\Article $resource
 */
final class ArticleSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'slug' => $this->resource->slug,
            'title' => $this->resource->title,
            'summary' => $this->resource->summary,
            'category' => $this->resource->category === null ? null : [
                'id' => $this->resource->category->getKey(),
                'slug' => $this->resource->category->slug,
                'name' => $this->resource->category->name,
            ],
            'publishedAt' => $this->resource->published_at?->toIso8601String(),
        ];
    }
}
