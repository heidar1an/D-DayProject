<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * سطر سفارش — فاز ۱۸.
 *
 * `snapshot` هم می‌آید: کاربر باید بتواند ببیند همان روز چه چیزی و با چه
 * قیمتی خریده است، حتی اگر قیمت طرح امروز عوض شده باشد. Snapshot هیچ دادهٔ
 * حساسی ندارد (فقط محصول، طرح، چرخه، تعداد و اعداد).
 */
class OrderLineResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'product_id' => $this->resource->product_id,
            'plan_id' => $this->resource->plan_id,
            'unit_minor' => (int) $this->resource->unit_minor,
            'quantity' => (int) $this->resource->quantity,
            'line_total_minor' => (int) $this->resource->line_total_minor,
            'snapshot' => $this->resource->snapshot ?? [],
        ];
    }
}
