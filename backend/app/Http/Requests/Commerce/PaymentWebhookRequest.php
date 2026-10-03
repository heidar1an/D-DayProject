<?php

namespace App\Http\Requests\Commerce;

use App\Http\Requests\ApiFormRequest;

/**
 * Webhook درگاه — فاز ۱۸.
 *
 * این تنها endpoint v1 است که سشن/CSRF ندارد؛ پس اعتبارسنجی ورودی باید سخت‌گیر
 * باشد:
 *   • `event_id` اجباری — بدون آن دفتر ضد تکرار نمی‌تواند replay را تشخیص دهد.
 *   • `amount_minor` عدد صحیح ≥ ۰ — **رشته پذیرفته نمی‌شود**؛ «۱۰۰۰» فارسی یا
 *     "1000.5" نباید به مسیر تطبیق مبلغ برسد.
 *   • `status` فقط از فهرست بسته — وضعیت دلخواه کلاینت معنا ندارد.
 *
 * امضا اینجا بررسی **نمی‌شود**؛ بررسی رمزنگاری‌شده کار آداپتور درگاه است.
 */
class PaymentWebhookRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'event_id' => ['required', 'string', 'max:96'],
            'authority' => ['required', 'string', 'max:96'],
            'amount_minor' => ['required', 'integer', 'min:0'],
            'status' => ['required', 'string', 'in:success,failed,cancelled,expired'],
            'reference' => ['nullable', 'string', 'max:96'],
        ];
    }
}
