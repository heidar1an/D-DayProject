<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Anatomy Asset پنل — فاز ۱۵.
 *
 * @property \App\Models\AnatomyAsset $resource
 */
final class AdminAnatomyAssetResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'part_key' => $this->resource->part_key,
            'label' => $this->resource->label,
            'category' => $this->resource->category,
            'subject_id' => $this->resource->subject_id,
            'media_id' => $this->resource->media_id,
            'media' => $this->resource->media === null ? null : [
                'id' => $this->resource->media->getKey(),
                'mime' => $this->resource->media->mime,
                'size_bytes' => (int) $this->resource->media->size_bytes,
            ],
            'status' => $this->resource->status,
            'version' => (int) $this->resource->version,
            'published_at' => $this->resource->published_at?->toIso8601String(),
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'updated_at' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
