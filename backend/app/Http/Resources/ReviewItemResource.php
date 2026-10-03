<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * آیتم مرور — فاز ۱۶. شکل آینهٔ ReviewNotebookService فرانت.
 *
 * @property \App\Models\ReviewItem $resource
 */
final class ReviewItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'sourceType' => $this->resource->source_type,
            'sourceId' => $this->resource->source_id,
            'title' => $this->resource->title,
            'subject' => $this->resource->subject,
            'description' => $this->resource->description,
            'activityType' => $this->resource->activity_type,
            'stage' => (int) $this->resource->stage,
            'status' => $this->resource->status,
            'learnedAt' => $this->resource->learned_at?->toIso8601String(),
            'lastReviewedAt' => $this->resource->last_reviewed_at?->toIso8601String(),
            'dueAt' => $this->resource->due_at?->toIso8601String(),
            'completedReviews' => (int) $this->resource->completed_reviews,
            'completedAt' => $this->resource->completed_at?->toIso8601String(),
            'history' => $this->resource->history ?? [],
            'createdAt' => $this->resource->created_at?->toIso8601String(),
            'updatedAt' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
