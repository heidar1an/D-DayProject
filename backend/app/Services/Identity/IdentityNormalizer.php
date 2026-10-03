<?php

namespace App\Services\Identity;

/**
 * نرمال‌سازی ورودی هویتی — **پیش از** هر مقایسه و هر uniqueness.
 *
 * چرا حیاتی است: در پروژهٔ قدیمی کاربر با «۰۹۱۲…» و «0912…» دو حساب متفاوت
 * می‌ساخت، چون ارقام فارسی به لاتین تبدیل می‌شد ولی email lowercase نمی‌شد.
 * Blueprint §4 صریح می‌گوید normalization باید قبل از uniqueness انجام شود.
 *
 * این کلاس خالص است (بدون I/O) تا در تست و در production دقیقاً یک رفتار داشته باشد.
 */
class IdentityNormalizer
{
    private const LATIN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    /** @var list<string> */
    private const PERSIAN = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    /** @var list<string> */
    private const ARABIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    /** ارقام فارسی/عربی → لاتین + trim. */
    public function digits(?string $value): string
    {
        $value = (string) $value;
        $value = str_replace(self::PERSIAN, self::LATIN, $value);
        $value = str_replace(self::ARABIC, self::LATIN, $value);

        return trim($value);
    }

    /** متن آزاد: فشرده‌سازی فاصله‌ها + trim؛ رشتهٔ خالی ⇒ null. */
    public function text(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $collapsed = preg_replace('/\s+/u', ' ', $value) ?? '';
        $trimmed = trim($collapsed);

        return $trimmed === '' ? null : $trimmed;
    }

    /**
     * موبایل/تلفن ایران به شکل استاندارد `0XXXXXXXXXX`.
     * `+98…` و `0098…` و `98…` به `0…` تبدیل می‌شوند تا یک شماره یک هویت باشد.
     */
    public function phone(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $digits = preg_replace('/[^\d+]/', '', $this->digits($value)) ?? '';

        if (str_starts_with($digits, '+98')) {
            $digits = '0'.substr($digits, 3);
        } elseif (str_starts_with($digits, '0098')) {
            $digits = '0'.substr($digits, 4);
        } elseif (strlen($digits) === 12 && str_starts_with($digits, '98')) {
            $digits = '0'.substr($digits, 2);
        }

        $digits = ltrim($digits, '+');

        return $digits === '' ? null : $digits;
    }

    /** email: trim + lowercase (کلید مقایسه و uniqueness، case-insensitive). */
    public function email(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : mb_strtolower($trimmed, 'UTF-8');
    }

    /** username: trim + lowercase (یکتا بودن باید case-insensitive باشد). */
    public function username(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : mb_strtolower($trimmed, 'UTF-8');
    }

    /** ترم: ارقام فارسی → لاتین و به‌صورت رشتهٔ رقمی ذخیره می‌شود. */
    public function term(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $digits = $this->digits($value);

        return $digits === '' ? null : $digits;
    }

    /**
     * تشخیص نوع identity برای ورود.
     *
     * @return array{type: 'phone'|'email'|'unknown', value: string}
     */
    public function identity(?string $value): array
    {
        $raw = $this->text($value);

        if ($raw === null) {
            return ['type' => 'unknown', 'value' => ''];
        }

        if (str_contains($raw, '@')) {
            $email = $this->email($raw);

            return $email === null ? ['type' => 'unknown', 'value' => ''] : ['type' => 'email', 'value' => $email];
        }

        $phone = $this->phone($raw);

        return $phone === null ? ['type' => 'unknown', 'value' => ''] : ['type' => 'phone', 'value' => $phone];
    }
}
