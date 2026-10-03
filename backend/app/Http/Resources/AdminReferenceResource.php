<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Reference پنل — فاز ۱۵. برخلاف Resource عمومی، status/version/نویسنده دارد.
 *
 * @property \App\Models\Reference $resource
 */
final class AdminReferenceResource extends JsonResource
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
            'status' => $this->resource->status,
            'version' => (int) $this->resource->version,
            'authorAdminId' => $this->resource->author_admin_id,
            'editorAdminId' => $this->resource->editor_admin_id,
            'publishedAt' => $this->resource->published_at?->toIso8601String(),
            'createdAt' => $this->resource->created_at?->toIso8601String(),
            'updatedAt' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
