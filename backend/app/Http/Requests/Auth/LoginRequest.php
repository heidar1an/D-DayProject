<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiFormRequest;

/**
 * ورود. `identity` نام متعارف است (موبایل یا ایمیل)؛ `phone` فقط به‌عنوان
 * نام قدیمی پذیرفته می‌شود تا کلاینت فعلی نشکند. اگر هر دو بیایند، `identity`
 * اولویت دارد.
 *
 * هیچ قاعده‌ای وجود حساب را تأیید نمی‌کند: اعتبارسنجی فقط «شکل» ورودی را
 * می‌سنجد و پاسخ خطا برای هر دو حالت یکسان است.
 */
class LoginRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('identity') && $this->filled('phone')) {
            $this->merge(['identity' => $this->input('phone')]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'identity' => ['required', 'string', 'max:190'],
            'phone' => ['nullable', 'string', 'max:32'],
            'password' => ['required', 'string', 'max:'.(int) config('identity.passwords.max_length')],
        ];
    }
}
