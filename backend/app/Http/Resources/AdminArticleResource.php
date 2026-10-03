<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مقالهٔ پنل — فاز ۱۶. `version` برای optimistic lock ادیتور (§30).
 *
 * @property \App\Models\Article $resource
 */
final class AdminArticleResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'category_id' => $this->resource->category_id,
            'category' => $this->resource->category === null ? null : [
                'id' => $this->resource->category->getKey(),
                'slug' => $this->resource->category->slug,
                'name' => $this->resource->category->name,
            ],
            'slug' => $this->resource->slug,
            'title' => $this->resource->title,
            'summary' => $this->resource->summary,
            'body' => $this->resource->body,
            'status' => $this->resource->status,
            'version' => (int) $this->resource->version,
            'author_admin_id' => $this->resource->author_admin_id,
            'editor_admin_id' => $this->resource->editor_admin_id,
            'published_at' => $this->resource->published_at?->toIso8601String(),
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'updated_at' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
