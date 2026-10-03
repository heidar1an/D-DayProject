<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * یادداشت شخصی — فاز ۱۶. شکل آینهٔ Note فرانت (mockData) است.
 *
 * @property \App\Models\UserNote $resource
 */
final class UserNoteResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $sourceType = $this->resource->source_type;

        return [
            'id' => $this->resource->getKey(),
            'kind' => $this->resource->kind,
            'title' => $this->resource->title,
            'body' => $this->resource->body,
            'content' => $this->resource->content ?? null,
            'subjectId' => $this->resource->subject_id,
            'tags' => $this->resource->tags ?? [],
            'color' => $this->resource->color,
            'pinned' => (bool) $this->resource->pinned,
            'source' => $sourceType === null ? null : [
                'sourceType' => $sourceType,
                'sourceId' => $this->resource->source_id,
                'title' => $this->resource->source_title,
            ],
            'createdAt' => $this->resource->created_at?->toIso8601String(),
            'updatedAt' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
