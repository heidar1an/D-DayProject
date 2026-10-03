<?php

namespace App\Services\Identity;

use Illuminate\Support\Facades\Hash;

/**
 * تنها نقطهٔ verify و ساخت رمز در پروژه.
 *
 * سه فرمت هش در سیستم وجود دارد/خواهد داشت:
 *
 *   1. Argon2id (`$argon2id$…`)  → الگوریتم جاری؛ همهٔ نوشتن‌های جدید
 *   2. scrypt (`scrypt$salt$hex`) → legacy Node؛ با `Scrypt` خالص PHP
 *   3. SHA-256 (۶۴ hex)           → legacy قدیمی‌تر؛ بدون salt
 *
 * هیچ‌کدام از این‌ها را نمی‌توان به دیگری «تبدیل» کرد؛ پس verify باید هر سه را
 * بشناسد و `needsRehash` تصمیم مهاجرت را می‌گیرد.
 *
 * ⚠️ رمز خام هرگز log نمی‌شود و هرگز از این کلاس بیرون نمی‌رود.
 */
class PasswordHasher
{
    public const ARGON2ID = 'argon2id';

    public const ARGON2I = 'argon2i';

    public const BCRYPT = 'bcrypt';

    public const SCRYPT = 'scrypt';

    public const SHA256 = 'sha256';

    public const UNKNOWN = 'unknown';

    /** هش جدید — همیشه با driver پیکربندی‌شده (پیش‌فرض argon2id). */
    public function hash(string $plain): string
    {
        return Hash::driver((string) config('identity.passwords.driver'))->make($plain);
    }

    /** تشخیص الگوریتم از روی خود هش ذخیره‌شده. */
    public function algorithm(string $stored): string
    {
        if (str_starts_with($stored, '$argon2id$')) {
            return self::ARGON2ID;
        }

        if (str_starts_with($stored, '$argon2i$')) {
            return self::ARGON2I;
        }

        if (preg_match('/^\$2[aby]\$/', $stored) === 1) {
            return self::BCRYPT;
        }

        if (preg_match('/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/', $stored) === 1) {
            return self::SCRYPT;
        }

        if (preg_match('/^[0-9a-f]{64}$/', $stored) === 1) {
            return self::SHA256;
        }

        return self::UNKNOWN;
    }

    /**
     * نکتهٔ مهم: `Hash::check` با **driver پیش‌فرض** کار نمی‌کند. هر driver
     * فقط هش الگوریتم خودش را می‌پذیرد و برای بقیه `RuntimeException` پرتاب
     * می‌کند (مثلاً argon2id driver روی هش bcrypt). پس هر الگوریتم به driver
     * خودش می‌رود و هر استثنا به «verify نشد» تبدیل می‌شود: یک هش خراب در
     * دیتابیس نباید درخواست را ۵۰۰ کند.
     */
    public function verify(string $plain, string $stored): bool
    {
        if ($stored === '') {
            return false;
        }

        return match ($this->algorithm($stored)) {
            self::ARGON2ID => $this->verifyWithDriver('argon2id', $plain, $stored),
            self::ARGON2I => $this->verifyWithDriver('argon', $plain, $stored),
            self::BCRYPT => $this->verifyWithDriver('bcrypt', $plain, $stored),
            self::SCRYPT => $this->verifyScrypt($plain, $stored),
            self::SHA256 => hash_equals($stored, hash('sha256', $plain)),
            default => false,
        };
    }

    /** آیا این هش باید بعد از ورود موفق دوباره ساخته شود؟ */
    public function needsRehash(string $stored): bool
    {
        if ($stored === '') {
            return false;
        }

        $driver = (string) config('identity.passwords.driver');

        if ($this->algorithm($stored) !== $driver) {
            return true;
        }

        try {
            return Hash::driver($driver)->needsRehash($stored);
        } catch (\RuntimeException) {
            // هش ناشناخته/خراب: از دید مهاجرت باید بازسازی شود.
            return true;
        }
    }

    private function verifyWithDriver(string $driver, string $plain, string $stored): bool
    {
        try {
            return Hash::driver($driver)->check($plain, $stored);
        } catch (\RuntimeException) {
            return false;
        }
    }

    /**
     * scrypt با پارامترهای **دقیقاً** پیش‌فرض `crypto.scryptSync` در Node.
     * اگر فرمت خراب باشد، verify شکست می‌خورد — نه استثنا (ورودی غیرقابل‌اعتماد
     * از دیتابیس نباید درخواست را ۵۰۰ کند).
     */
    private function verifyScrypt(string $plain, string $stored): bool
    {
        $parts = explode('$', $stored);

        if (count($parts) !== 3) {
            return false;
        }

        [, $saltHex, $derivedHex] = $parts;

        if ($saltHex === '' || $derivedHex === '' || strlen($derivedHex) % 2 !== 0) {
            return false;
        }

        $salt = @hex2bin($saltHex);
        $expected = @hex2bin($derivedHex);

        if ($salt === false || $expected === false || $expected === '') {
            return false;
        }

        $config = config('identity.passwords.legacy_scrypt');

        $actual = Scrypt::derive(
            $plain,
            $salt,
            (int) $config['n'],
            (int) $config['r'],
            (int) $config['p'],
            strlen($expected),
        );

        return hash_equals($expected, $actual);
    }
}
