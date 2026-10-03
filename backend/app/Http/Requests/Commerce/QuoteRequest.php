<?php

namespace App\Http\Requests\Commerce;

use App\Http\Requests\ApiFormRequest;

/**
 * درخواست قیمت (Quote) — فاز ۱۸.
 *
 * ⚠️ **هیچ فیلد مبلغی اینجا نیست.** نه `amount`، نه `price`، نه `discount`، نه
 * `currency`. کلاینت فقط قصد را می‌فرستد و سرور مبلغ را می‌سازد. اگر کسی
 * `amount` بفرستد، به `validated()` راه نمی‌یابد و کاملاً نادیده گرفته می‌شود
 * (Prompt §22/§30/§52).
 *
 * `planId` = sku محصول در قرارداد UI (`regular`/`pro`/`group`)، نه UUID داخلی.
 */
class QuoteRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'planId' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'cycleId' => ['required', 'string', 'in:'.implode(',', array_values((array) config('commerce.cycles')))],
            'seats' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('commerce.orders.max_seats')],
        ];
    }
}
