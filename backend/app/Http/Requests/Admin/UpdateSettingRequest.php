<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * به‌روزرسانی یک تنظیم — فاز ۲۰ (§80/§81).
 *
 * `version` برای optimistic lock است؛ اگر کلاینت نفرستد، آخرین مقدار برنده
 * می‌شود (رفتار صریح، نه تصادفی). کلید ناشناخته در سرویس ۴۲۲ می‌گیرد.
 */
final class UpdateSettingRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'key' => ['required', 'string', 'max:96', 'regex:/^[a-z0-9._]+$/'],
            'value' => ['present', 'nullable'],
            'version' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
