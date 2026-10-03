<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * پرداخت — فاز ۱۸.
 *
 * `authority` می‌آید چون خود کاربر برای تکمیل پرداخت به آن نیاز دارد و در
 * redirect درگاه هم دیده است. اما `provider_reference` و هر چیز دیگری که
 * رازِ درگاه باشد نمی‌آید. `user_id` هم نمی‌آید (مالکیت فقط از سشن).
 */
class PaymentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'order_id' => $this->resource->order_id,
            'provider' => $this->resource->provider,
            'authority' => $this->resource->authority,
            'status' => $this->resource->status,
            'amount_minor' => (int) $this->resource->amount_minor,
            'currency' => $this->resource->currency,
            'verified_at' => $this->resource->verified_at?->toIso8601String(),
            'created_at' => $this->resource->created_at?->toIso8601String(),
        ];
    }
}
