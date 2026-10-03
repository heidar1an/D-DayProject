<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * کاربر در پنل — فاز ۲۰ (§101).
 *
 * این Resource **مخصوص پنل** است، نه نسخهٔ تغییر‌یافتهٔ Resource عمومی. هیچ‌گاه
 * `password_hash`، `google_subject` یا توکن سشن برنمی‌گرداند؛ اینکه حساب گوگل
 * وصل است فقط به‌صورت boolean می‌آید.
 *
 * @property User $resource
 */
final class UserAdminResource extends JsonResource
{
    public function __construct(User $resource, private readonly bool $googleLinked = false)
    {
        parent::__construct($resource);
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'phone' => $this->resource->phone,
            'email' => $this->resource->email,
            'emailVerified' => $this->resource->email_verified_at !== null,
            'emailVerifiedAt' => $this->resource->email_verified_at?->toIso8601String(),
            'googleLinked' => $this->googleLinked,
            'createdAt' => $this->resource->created_at?->toIso8601String(),
            'updatedAt' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
