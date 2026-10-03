<?php

namespace App\Services\Groups;

use App\Exceptions\ApiErrorException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * تولید/نرمال‌سازی/هش کد گروه — فاز ۱۶ (§39).
 *
 * کد فقط یک‌بار در پاسخ create/rotate برمی‌گردد و در دیتابیس **فقط SHA-256**
 * می‌نشیند. Plaintext هرگز در لاگ هم نمی‌رود (§44). نرمال‌سازی همان قرارداد
 * فرانت است: ارقام فارسی/عربی → لاتین، حروف بزرگ، حذف فاصله/خط‌تیره.
 */
final class GroupCodeService
{
    public function generate(): string
    {
        $prefix = (string) config('groups.code.prefix');
        $length = (int) config('groups.code.body_length');
        $alphabet = (string) config('groups.code.alphabet');

        $body = '';

        for ($i = 0; $i < $length; $i++) {
            $body .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $prefix.$body;
    }

    /** ورودی خام کاربر → کد نرمال‌شده (قرارداد یکسان با فرانت). */
    public function normalize(string $raw): string
    {
        $cleaned = strtr($raw, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9', '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']);

        $cleaned = strtoupper(preg_replace('/[\s\-_]/u', '', $cleaned) ?? '');

        $prefix = (string) config('groups.code.prefix');
        $body = str_starts_with($cleaned, $prefix) ? substr($cleaned, strlen($prefix)) : $cleaned;

        return $body === '' ? '' : $prefix.$body;
    }

    /**
     * @return array{code: string, hash: string}
     */
    public function generateWithHash(): array
    {
        $code = $this->generate();

        return ['code' => $code, 'hash' => $this->hash($code)];
    }

    public function hash(string $normalizedCode): string
    {
        return hash('sha256', $normalizedCode);
    }

    public function assertFormat(string $normalizedCode): void
    {
        $prefix = (string) config('groups.code.prefix');
        $length = (int) config('groups.code.body_length');

        if (! preg_match('/^'.preg_quote($prefix, '/').'[A-Z0-9]{'.$length.'}$/', $normalizedCode)) {
            throw new ApiErrorException('GROUP_CODE_FORMAT', 422, 'The group code format is invalid.', ['code' => ['The group code format is invalid.']]);
        }
    }

    public function randomToken(): string
    {
        return (string) Str::uuid();
    }
}
