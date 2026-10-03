<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Entitlement — فاز ۱۸.
 *
 * `active` محاسبهٔ سرور است (شروع/پایان/لغو)، نه یک پرچم ذخیره‌شده. `revoked`
 * هم می‌آید تا UI بتواند بین «منقضی شد» و «لغو شد» تفاوت بگذارد.
 *
 * `source_order_id` می‌آید (کاربر مالک آن سفارش است) ولی `user_id` نه.
 */
class EntitlementResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'capability' => $this->resource->capability,
            'active' => $this->resource->isActive(),
            'revoked' => $this->resource->revoked_at !== null,
            'source_order_id' => $this->resource->source_order_id,
            'starts_at' => $this->resource->starts_at?->toIso8601String(),
            'ends_at' => $this->resource->ends_at?->toIso8601String(),
            'revoked_at' => $this->resource->revoked_at?->toIso8601String(),
        ];
    }
}
