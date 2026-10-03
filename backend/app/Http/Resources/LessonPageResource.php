<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل عمومی صفحهٔ درس.
 *
 * `body` عمداً برنمی‌گردد: فاز ۵/۶ آن را مصرف نمی‌کند و ارسال حجم بزرگ متن
 * خام در فهرست صفحه‌ها هم هزینه دارد هم سطح حمله را بیشتر می‌کند.
 */
class LessonPageResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'slug' => $this->resource->slug,
            'title' => $this->resource->title,
            'sort_order' => $this->resource->sort_order,
            'lesson_id' => $this->resource->lesson_id,
        ];
    }
}
