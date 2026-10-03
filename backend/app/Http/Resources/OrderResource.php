<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * سفارش — فاز ۱۸.
 *
 * `quote_snapshot` همان عکس محاسبه است: ورودی‌های قیمت و مبلغ نهایی. اینجا
 * می‌آید تا کاربر (و پشتیبانی) بتواند معامله را بازسازی کند. هیچ Secret،
 * توکن یا دادهٔ پرداختی در snapshot نیست — فقط اعداد و شناسهٔ محصول/طرح.
 *
 * `user_id` عمداً **نیست**: هیچ پاسخی نباید اجازهٔ «دیدن مالک» را القا کند؛
 * مالکیت فقط از سشن می‌آید.
 */
class OrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'status' => $this->resource->status,
            'total_minor' => (int) $this->resource->total_minor,
            'currency' => $this->resource->currency,
            'quote_snapshot' => $this->resource->quote_snapshot ?? [],
            'expires_at' => $this->resource->expires_at?->toIso8601String(),
            'paid_at' => $this->resource->paid_at?->toIso8601String(),
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'lines' => OrderLineResource::collection($this->whenLoaded('lines')),
        ];
    }
}
