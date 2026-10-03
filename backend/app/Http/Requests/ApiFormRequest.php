<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

/**
 * کلاس پایهٔ FormRequest برای همهٔ endpointهای آیندهٔ v1.
 * شکست اعتبارسنجی → envelope خطای استاندارد (۴۲۲ / VALIDATION_FAILED + fields).
 * فاز ۱ هیچ rule کسب‌وکاری ندارد؛ ماژول‌ها FormRequest خودشان را از این کلاس
 * می‌سازند. معماری هدف: Controller → Request → Service/Action → Model → Resource.
 */
abstract class ApiFormRequest extends FormRequest
{
    public function failedValidation(Validator $validator): void
    {
        throw (new ValidationException($validator))->status(422);
    }
}
