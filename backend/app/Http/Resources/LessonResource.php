<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** شکل عمومی درس/واحد به‌همراه فهرست صفحه‌های منتشرشده. */
class LessonResource extends JsonResource
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
            'pages' => LessonPageResource::collection($this->whenLoaded('pages')),
        ];
    }
}
