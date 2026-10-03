<?php

namespace App\Http\Requests\Commerce;

use App\Http\Requests\ApiFormRequest;

/**
 * تأیید پرداخت — فاز ۱۸.
 *
 * ورودی فقط `signature` است: شاهد رمزنگاری‌شدهٔ درگاه برای همین تراکنش.
 * مبلغ از **سفارش** خوانده می‌شود، نه از درخواست؛ پس حتی اگر کلاینت مبلغ
 * بفرستد، نادیده گرفته می‌شود (§40).
 */
class VerifyPaymentRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'signature' => ['nullable', 'string', 'max:255'],
        ];
    }
}
