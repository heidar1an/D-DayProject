<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * دانشگاه در v1.
 *
 * `slug` کلید پایدار و عمومی است (همان `id` در فرانت‌اند)؛ `id` صرفاً UUID
 * داخلی برای ارجاع در `user_profiles.university_id`.
 */
class UniversityResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'slug' => $this->resource->slug,
            'name' => $this->resource->name,
        ];
    }
}
