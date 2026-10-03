<?php

namespace App\Http\Requests\Me;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Auth\RegisterRequest;

/**
 * ویرایش پروفایل (PATCH).
 *
 * دو چیز اینجا تضمین می‌شود:
 *   1. نام‌های قدیمی فرانت‌اند (`avatar`, `referralSources`) در
 *      `prepareForValidation` به نام‌های متعارف v1 نگاشت می‌شوند — تا کلاینتی
 *      که همان فیلدهای امروز را می‌فرستد، بی‌صدا داده از دست ندهد.
 *   2. فیلدهای هویتی/مجوزی با `prohibited` رد می‌شوند: `role`, `permissions`,
 *      `password_hash`, `user_id`, `id`, `entitlement`, ...
 */
class UpdateProfileRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $aliases = [
            'avatar' => 'avatar_key',
            'referralSources' => 'referrals',
            'referral_sources' => 'referrals',
            'firstName' => 'first_name',
            'lastName' => 'last_name',
            'birthDate' => 'birth_date_jalali',
        ];

        foreach ($aliases as $legacy => $canonical) {
            if ($this->has($legacy) && ! $this->has($canonical)) {
                $this->merge([$canonical => $this->input($legacy)]);
            }

            if ($this->has($legacy)) {
                $this->offsetUnset($legacy);
            }
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'username' => ['nullable', 'string', 'max:32'],
            'first_name' => ['nullable', 'string', 'max:60'],
            'last_name' => ['nullable', 'string', 'max:60'],
            'university_id' => ['nullable', 'string', 'uuid'],
            // نام قدیمی پروژه: نام کامل دانشگاه به‌جای UUID. سرور خودش به
            // `university_id` نگاشت می‌کند تا کلاینت فعلی داده از دست ندهد.
            'university' => ['nullable', 'string', 'max:160'],
            'term' => ['nullable', 'string', 'max:8'],
            'grade' => ['nullable', 'string', 'max:80'],
            'gender' => ['nullable', 'string', 'max:20'],
            'birth_date_jalali' => ['nullable', 'string', 'max:10'],
            'avatar_key' => ['nullable', 'string', 'max:8'],
            'motivations' => ['nullable', 'array', 'max:'.(int) config('identity.profile.max_list_items')],
            'motivations.*' => ['string', 'max:64'],
            'referrals' => ['nullable', 'array', 'max:'.(int) config('identity.profile.max_list_items')],
            'referrals.*' => ['string', 'max:64'],

            ...RegisterRequest::forbiddenFields(),

            // این‌ها ستون‌های `users` هستند، نه پروفایل. تغییر شماره/ایمیل یک
            // جریان تأیید جدا می‌خواهد (فاز بعد)، پس اینجا صریحاً رد می‌شوند.
            'phone' => ['prohibited'],
            'email' => ['prohibited'],
            'password' => ['prohibited'],
            'password_confirmation' => ['prohibited'],
            'password_hash' => ['prohibited'],
        ];
    }
}
