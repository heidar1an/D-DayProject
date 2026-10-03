<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل عمومی درس. هیچ فیلد مدیریتی (`author_admin_id`, `editor_admin_id`,
 * `version`) و هیچ بدنهٔ خامی برنمی‌گرداند.
 */
class SubjectResource extends JsonResource
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
            'course_count' => $this->whenCounted('courses'),
        ];
    }
}
