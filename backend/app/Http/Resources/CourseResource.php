<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** شکل عمومی دوره. `subject` فقط وقتی بارگذاری شده باشد می‌آید. */
class CourseResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'slug' => $this->resource->slug,
            'title' => $this->resource->title,
            'description' => $this->resource->description,
            'sort_order' => $this->resource->sort_order,
            'subject' => new SubjectResource($this->whenLoaded('subject')),
            'chapters' => ChapterResource::collection($this->whenLoaded('chapters')),
        ];
    }
}
