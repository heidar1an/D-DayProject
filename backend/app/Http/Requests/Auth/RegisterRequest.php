<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiFormRequest;

/**
 * اعتبارسنجی نحوی ثبت‌نام. اعتبارسنجی معنایی (سیاست رمز، یکتایی، نرمال‌سازی)
 * در `RegistrationService` انجام می‌شود.
 *
 * فیلدهای غیرمجاز با قاعدهٔ `prohibited` **رد** می‌شوند (۴۲۲)، نه نادیده گرفته:
 * اگر کلاینت `role=admin` بفرستد باید صریحاً بفهمد که این فیلد پذیرفته نیست.
 * نقش هرگز از ورودی خوانده نمی‌شود.
 */
class RegisterRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:190'],
            'password' => ['required', 'string', 'max:'.(int) config('identity.passwords.max_length')],

            'profile' => ['nullable', 'array'],
            'profile.username' => ['nullable', 'string', 'max:32'],
            'profile.first_name' => ['nullable', 'string', 'max:60'],
            'profile.last_name' => ['nullable', 'string', 'max:60'],
            'profile.university_id' => ['nullable', 'string', 'uuid'],
            'profile.term' => ['nullable', 'string', 'max:8'],
            'profile.grade' => ['nullable', 'string', 'max:80'],
            'profile.gender' => ['nullable', 'string', 'max:20'],
            'profile.birth_date_jalali' => ['nullable', 'string', 'max:10'],
            'profile.avatar_key' => ['nullable', 'string', 'max:8'],
            'profile.motivations' => ['nullable', 'array', 'max:'.(int) config('identity.profile.max_list_items')],
            'profile.motivations.*' => ['string', 'max:64'],
            'profile.referrals' => ['nullable', 'array', 'max:'.(int) config('identity.profile.max_list_items')],
            'profile.referrals.*' => ['string', 'max:64'],

            ...self::forbiddenFields(),
        ];
    }

    /**
     * فیلدهایی که هیچ‌گاه نباید از کلاینت پذیرفته شوند.
     *
     * @return array<string, list<string>>
     */
    public static function forbiddenFields(): array
    {
        $forbidden = ['prohibited'];

        $fields = [
            'id', 'user_id', 'role', 'roles', 'permissions', 'is_admin', 'admin',
            'password_hash', 'entitlement', 'entitlements', 'email_verified_at',
            'google_subject', 'created_at', 'updated_at',
            'profile.id', 'profile.user_id', 'profile.role', 'profile.permissions',
        ];

        return array_fill_keys($fields, $forbidden);
    }
}
