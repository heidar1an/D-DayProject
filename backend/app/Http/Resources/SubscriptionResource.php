<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * اشتراک — فاز ۱۸.
 *
 * `effective` محاسبهٔ سرور است، نه بازتاب خام `status`: «active ولی ends_at
 * گذشته» برای کاربر یعنی **غیرفعال**. اگر فقط status را می‌فرستادیم، UI مجبور
 * می‌شد تاریخ را خودش تفسیر کند و دو تعریف واگرا می‌شد (§75).
 */
class SubscriptionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'status' => $this->resource->status,
            'effective' => $this->resource->isEffective(),
            'starts_at' => $this->resource->starts_at?->toIso8601String(),
            'ends_at' => $this->resource->ends_at?->toIso8601String(),
            'plan' => $this->resource->plan === null ? null : [
                'code' => $this->resource->plan->code,
                'cycle_months' => (int) $this->resource->plan->cycle_months,
                'product' => $this->resource->plan->product?->sku,
            ],
        ];
    }
}
