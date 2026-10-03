<?php

namespace App\Support\Search;

use App\Support\Content\PersianText;

/**
 * نرمال‌سازی پرس‌وجو و متن برای FTS — فاز ۱۹ (§35).
 *
 * پایه همان `PersianText` پروژه است (ی/ي، ک/ك، نیم‌فاصله، ارقام) و اینجا فقط
 * چیزهایی اضافه می‌شود که مخصوص جست‌وجو است: lowercase، توکن‌بندی، ساخت
 * `tsquery` امن و الگوی `LIKE` برای درایورهایی که tsvector ندارند.
 *
 * ⚠️ توکن‌ها **فقط** `\p{L}` و `\p{N}` نگه می‌دارند. این تنها سد در برابر
 * تزریق در `to_tsquery` است؛ هیچ رشتهٔ خام کاربر وارد عبارت نمی‌شود (§42).
 */
final class SearchNormalizer
{
    /** حداکثر توکن مؤثر — پرس‌وجوی ۵۰ کلمه‌ای یعنی اسکن بی‌فایده. */
    private const MAX_TOKENS = 10;

    public static function normalize(string $value): string
    {
        $value = PersianText::normalize($value);

        return mb_strtolower($value, 'UTF-8');
    }

    /** @return list<string> */
    public static function tokens(string $value): array
    {
        $normalized = self::normalize($value);

        if ($normalized === '') {
            return [];
        }

        $parts = preg_split('/[^\p{L}\p{N}]+/u', $normalized) ?: [];
        $tokens = [];

        foreach ($parts as $part) {
            if (mb_strlen($part) < 2) {
                continue; /* تک‌حرف = تطابق تقریباً همه‌چیز. */
            }

            $tokens[$part] = true;

            if (count($tokens) >= self::MAX_TOKENS) {
                break;
            }
        }

        return array_keys($tokens);
    }

    /**
     * عبارت `tsquery` با تطابق پیشوندی — `کلیه` ⇒ `کلیه:*`.
     * اگر توکن معتبری نماند، `null` برمی‌گردد و کوئری اجرا نمی‌شود.
     */
    public static function tsQuery(string $value): ?string
    {
        $tokens = self::tokens($value);

        if ($tokens === []) {
            return null;
        }

        return implode(' & ', array_map(static fn (string $token): string => $token.':*', $tokens));
    }

    /**
     * الگوهای `LIKE` برای درایور بدون FTS (SQLite در تست/توسعه).
     *
     * @return list<string>
     */
    public static function likePatterns(string $value): array
    {
        return array_map(static fn (string $token): string => '%'.$token.'%', self::tokens($value));
    }

    /**
     * برش متن برای نمایش — حول نخستین توکن منطبق، وگرنه از ابتدا.
     * متن خروجی نرمال‌شده نیست؛ همان متن اصلی است تا خوانا بماند.
     */
    public static function snippet(string $text, array $tokens, int $length = 160): string
    {
        $flat = preg_replace('/\s+/u', ' ', trim($text)) ?? trim($text);

        if ($flat === '') {
            return '';
        }

        $haystack = self::normalize($flat);
        $position = null;

        foreach ($tokens as $token) {
            $found = mb_strpos($haystack, $token);

            if ($found !== false && ($position === null || $found < $position)) {
                $position = $found;
            }
        }

        /*
         * پنجره باید **توکن را در خود داشته باشد**: اگر از `position - length`
         * شروع کنیم، توکن دقیقاً بیرونِ انتهای پنجره می‌افتد. پس فقط بخشی از
         * طول پنجره را پیش از توکن می‌گیریم.
         */
        $lead = max(1, intdiv($length, 4));

        if ($position === null || $position <= $lead) {
            return mb_substr($flat, 0, $length).(mb_strlen($flat) > $length ? '…' : '');
        }

        $start = $position - $lead;
        $excerpt = mb_substr($flat, $start, $length);

        return '…'.$excerpt.(mb_strlen($flat) > $start + $length ? '…' : '');
    }
}
