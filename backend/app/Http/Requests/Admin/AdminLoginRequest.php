<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;

/**
 * ورود ادمین. نام کاربری و رمز.
 *
 * هیچ قاعده‌ای وجود حساب را تأیید نمی‌کند: پاسخ برای «ادمین نیست» و «رمز غلط»
 * یکسان است.
 */
class AdminLoginRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'max:'.(int) config('identity.passwords.max_length')],
        ];
    }
}
