<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل عمومی کاربر در v1.
 *
 * هیچ‌گاه این‌ها را برنمی‌گرداند: `password_hash`, `google_subject`, هیچ توکنی،
 * هیچ نقشی (فاز ۲ نقشی ندارد) و هیچ فیلد داخلی دیتابیس.
 */
class UserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'phone' => $this->resource->phone,
            'email' => $this->resource->email,
            'email_verified_at' => $this->resource->email_verified_at?->toIso8601String(),
            'has_password' => $this->resource->hasPassword(),
            'google_linked' => $this->resource->google_subject !== null,
            'profile' => new ProfileResource($this->whenLoaded('profile')),
            'created_at' => $this->resource->created_at?->toIso8601String(),
        ];
    }
}
