<?php

namespace App\Services\Identity;

use InvalidArgumentException;

/**
 * scrypt (RFC 7914) — پیاده‌سازی خالص PHP.
 *
 * چرا لازم است: هش‌های قدیمی پروژه با `crypto.scryptSync` در Node ساخته شده‌اند
 * (`scrypt$salt$hash`) و PHP هیچ تابع scrypt با پارامتر آزاد ندارد:
 *   • `sodium_crypto_pwhash_scryptsalsa208sha256_ll` در این build وجود ندارد.
 *   • تابع سطح‌بالای sodium هم salt دقیقاً ۳۲ بایتی می‌خواهد، در حالی که salt
 *     قدیمی ۱۶ بایتی است ⇒ خروجی متفاوت می‌شد و verify هیچ‌وقت موفق نمی‌شد.
 *
 * پس پارامترها آزادانه پیاده‌سازی شده‌اند و خروجی با fixture واقعی Node
 * اعتبارسنجی می‌شود (`tests/Unit/ScryptTest.php`).
 *
 * ⚠️ این مسیر **فقط** برای verify هش‌های legacy است؛ نوشتن هش جدید همیشه با
 * Argon2id انجام می‌شود. هزینهٔ CPU آن یک‌بار در عمر هر حساب پرداخت می‌شود.
 */
final class Scrypt
{
    private const MASK = 0xFFFFFFFF;

    public static function derive(string $password, string $salt, int $n, int $r, int $p, int $length): string
    {
        if ($n < 2 || ($n & ($n - 1)) !== 0) {
            throw new InvalidArgumentException('scrypt: N must be a power of two greater than 1.');
        }

        if ($r < 1 || $p < 1 || $length < 1) {
            throw new InvalidArgumentException('scrypt: r, p and length must be positive.');
        }

        $blockSize = 128 * $r;
        $blocks = hash_pbkdf2('sha256', $password, $salt, 1, $p * $blockSize, true);
        $mixed = '';

        for ($i = 0; $i < $p; $i++) {
            $mixed .= self::smix(substr($blocks, $i * $blockSize, $blockSize), $n, $r);
        }

        return hash_pbkdf2('sha256', $password, $mixed, 1, $length, true);
    }

    private static function smix(string $block, int $n, int $r): string
    {
        /** @var array<int, string> $v */
        $v = [];
        $x = $block;

        for ($i = 0; $i < $n; $i++) {
            $v[$i] = $x;
            $x = self::blockMix($x, $r);
        }

        for ($i = 0; $i < $n; $i++) {
            // Integerify: نخستین ۴ بایت آخرین بلوک ۶۴ بایتی، little-endian.
            $j = unpack('V', substr($x, ((2 * $r) - 1) * 64, 4))[1] % $n;
            $x = self::blockMix($x ^ $v[$j], $r);
        }

        return $x;
    }

    private static function blockMix(string $b, int $r): string
    {
        $x = substr($b, ((2 * $r) - 1) * 64, 64);
        $even = '';
        $odd = '';

        for ($i = 0; $i < 2 * $r; $i++) {
            $x = self::salsa20_8($x ^ substr($b, $i * 64, 64));

            if (($i & 1) === 0) {
                $even .= $x;
            } else {
                $odd .= $x;
            }
        }

        return $even.$odd;
    }

    /**
     * هستهٔ Salsa20/8 — با متغیرهای محلی نوشته شده (نه آرایه).
     * اندازه‌گیری‌شده روی همین ماشین: نسخهٔ آرایه‌ای ۴٫۰s و این نسخه ~۲٫۵ برابر
     * سریع‌تر است؛ چون این تابع ۶۵٬۵۳۶ بار در هر verify صدا زده می‌شود، تفاوت
     * مستقیماً روی تأخیر ورود کاربران قدیمی اثر دارد.
     */
    private static function salsa20_8(string $in): string
    {
        $w = unpack('V16', $in);

        $x0 = $w[1];
        $x1 = $w[2];
        $x2 = $w[3];
        $x3 = $w[4];
        $x4 = $w[5];
        $x5 = $w[6];
        $x6 = $w[7];
        $x7 = $w[8];
        $x8 = $w[9];
        $x9 = $w[10];
        $x10 = $w[11];
        $x11 = $w[12];
        $x12 = $w[13];
        $x13 = $w[14];
        $x14 = $w[15];
        $x15 = $w[16];

        $z0 = $x0;
        $z1 = $x1;
        $z2 = $x2;
        $z3 = $x3;
        $z4 = $x4;
        $z5 = $x5;
        $z6 = $x6;
        $z7 = $x7;
        $z8 = $x8;
        $z9 = $x9;
        $z10 = $x10;
        $z11 = $x11;
        $z12 = $x12;
        $z13 = $x13;
        $z14 = $x14;
        $z15 = $x15;

        for ($i = 0; $i < 4; $i++) {
            $x4 ^= self::rotl($x0 + $x12, 7);
            $x8 ^= self::rotl($x4 + $x0, 9);
            $x12 ^= self::rotl($x8 + $x4, 13);
            $x0 ^= self::rotl($x12 + $x8, 18);

            $x9 ^= self::rotl($x5 + $x1, 7);
            $x13 ^= self::rotl($x9 + $x5, 9);
            $x1 ^= self::rotl($x13 + $x9, 13);
            $x5 ^= self::rotl($x1 + $x13, 18);

            $x14 ^= self::rotl($x10 + $x6, 7);
            $x2 ^= self::rotl($x14 + $x10, 9);
            $x6 ^= self::rotl($x2 + $x14, 13);
            $x10 ^= self::rotl($x6 + $x2, 18);

            $x3 ^= self::rotl($x15 + $x11, 7);
            $x7 ^= self::rotl($x3 + $x15, 9);
            $x11 ^= self::rotl($x7 + $x3, 13);
            $x15 ^= self::rotl($x11 + $x7, 18);

            $x1 ^= self::rotl($x0 + $x3, 7);
            $x2 ^= self::rotl($x1 + $x0, 9);
            $x3 ^= self::rotl($x2 + $x1, 13);
            $x0 ^= self::rotl($x3 + $x2, 18);

            $x6 ^= self::rotl($x5 + $x4, 7);
            $x7 ^= self::rotl($x6 + $x5, 9);
            $x4 ^= self::rotl($x7 + $x6, 13);
            $x5 ^= self::rotl($x4 + $x7, 18);

            $x11 ^= self::rotl($x10 + $x9, 7);
            $x8 ^= self::rotl($x11 + $x10, 9);
            $x9 ^= self::rotl($x8 + $x11, 13);
            $x10 ^= self::rotl($x9 + $x8, 18);

            $x12 ^= self::rotl($x15 + $x14, 7);
            $x13 ^= self::rotl($x12 + $x15, 9);
            $x14 ^= self::rotl($x13 + $x12, 13);
            $x15 ^= self::rotl($x14 + $x13, 18);
        }

        return pack(
            'V16',
            ($x0 + $z0) & self::MASK,
            ($x1 + $z1) & self::MASK,
            ($x2 + $z2) & self::MASK,
            ($x3 + $z3) & self::MASK,
            ($x4 + $z4) & self::MASK,
            ($x5 + $z5) & self::MASK,
            ($x6 + $z6) & self::MASK,
            ($x7 + $z7) & self::MASK,
            ($x8 + $z8) & self::MASK,
            ($x9 + $z9) & self::MASK,
            ($x10 + $z10) & self::MASK,
            ($x11 + $z11) & self::MASK,
            ($x12 + $z12) & self::MASK,
            ($x13 + $z13) & self::MASK,
            ($x14 + $z14) & self::MASK,
            ($x15 + $z15) & self::MASK,
        );
    }

    private static function rotl(int $value, int $shift): int
    {
        $value &= self::MASK;

        return (($value << $shift) | ($value >> (32 - $shift))) & self::MASK;
    }
}
