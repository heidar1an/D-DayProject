<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * پروفایل در v1.
 *
 * `university_id` همیشه می‌آید؛ `university` (شیء `{id, slug, name}`) فقط وقتی
 * رابطه load شده باشد. فیلدهای خالی `null` برمی‌گردند تا شکل پاسخ ثابت بماند و
 * کلاینت مجبور نباشد وجود کلید را چک کند.
 */
class ProfileResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'username' => $this->resource->username,
            'first_name' => $this->resource->first_name,
            'last_name' => $this->resource->last_name,
            'university_id' => $this->resource->university_id,
            'university' => new UniversityResource($this->whenLoaded('university')),
            'term' => $this->resource->term,
            'grade' => $this->resource->grade,
            'birth_date_jalali' => $this->resource->birth_date_jalali,
            'gender' => $this->resource->gender,
            'avatar_key' => $this->resource->avatar_key,
            'motivations' => $this->resource->motivations ?? [],
            'referrals' => $this->resource->referrals ?? [],
            'updated_at' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
