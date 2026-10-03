<?php

namespace App\Support\Content;

/**
 * نرمال‌سازی متن فارسی/عربی — مشترک جست‌وجو و پیشنهاد ویکی.
 *
 * چرا لازم است: کاربر «کلیه» را با «ك» عربی یا «ی» عربی تایپ می‌کند و همان
 * کلمه با «ک»/«ی» فارسی در دیتابیس ذخیره شده. بدون نرمال‌سازی، جست‌وجوی ساده
 * نتیجهٔ خالی می‌دهد و کاربر فکر می‌کند محتوا وجود ندارد.
 *
 * ⚠️ این نرمال‌سازی **موتور جست‌وجو نیست**. Blueprint می‌گوید FTS/tsvector فاز
 * زیرساختی بعدی است؛ اینجا فقط نرمال‌سازی رشته برای `ILIKE` محدود انجام می‌شود.
 */
final class PersianText
{
    /** @var array<string, string> */
    private const LETTER_MAP = [
        'ي' => 'ی', 'ى' => 'ی', 'ئ' => 'ی',   // ی عربی/الف مقصوره/همزه روی ی
        'ك' => 'ک',                             // ک عربی
        'ة' => 'ه', 'ۀ' => 'ه',                 // تای گرد/های با همزه
        'أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ٱ' => 'ا',
        'ؤ' => 'و',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
    ];

    /**
     * نرمال‌سازی پایه: حروف عربی→فارسی، حذف نیم‌فاصله/کشیده، یکسان‌سازی فاصله‌ها.
     *
     * نیم‌فاصله (U+200C) به **فاصله** تبدیل می‌شود، نه حذف؛ چون فرم «نیم‌فاصله»
     * و «نیم فاصله» باید به یک شکل برسند و `searchVariants()` نسخهٔ بدون فاصله را
     * هم می‌سازد.
     */
    public static function normalize(string $value): string
    {
        $value = strtr($value, self::LETTER_MAP);

        // نیم‌فاصله، ZWJ، کشیده (تطویل) و نویسه‌های کنترلی.
        $value = str_replace(["\u{200C}", "\u{200D}", "\u{0640}"], ' ', $value);
        $value = preg_replace('/[\x{0000}-\x{001F}\x{007F}]/u', ' ', $value) ?? $value;

        // یکسان‌سازی انواع فاصله و جمع‌کردن فاصله‌های تکراری.
        $value = preg_replace('/[\x{00A0}\x{2000}-\x{200B}\x{202F}\x{205F}\x{3000}]/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        return trim($value);
    }

    /**
     * نسخه‌های جست‌وجو برای یک عبارت — **بدون** تغییر دیتابیس.
     *
     * چرا دو نسخه: نه می‌دانیم کاربر نیم‌فاصله می‌زند و نه می‌دانیم متن ذخیره‌شده
     * کدام شکل است. `[«نیم فاصله», «نیمفاصله»]` هر دو حالت را پوشش می‌دهد و
     * لازم نیست ستون نرمال‌شدهٔ جدا نگه داریم (که در این فاز بی‌مصرف است).
     *
     * @return list<string>
     */
    public static function searchVariants(string $value): array
    {
        $normalized = self::normalize($value);

        if ($normalized === '') {
            return [];
        }

        $compact = preg_replace('/\s+/u', '', $normalized) ?? $normalized;

        $variants = [$normalized];

        if ($compact !== '' && $compact !== $normalized) {
            $variants[] = $compact;
        }

        return array_values(array_unique($variants));
    }

    /** آماده‌سازی برای مقایسه/ذخیرهٔ slug: ASCII lowercase، فاصله→خط تیره. */
    public static function slugify(string $value): string
    {
        $value = self::normalize($value);
        $value = mb_strtolower($value, 'UTF-8');
        $value = preg_replace('/[^\p{L}\p{N}]+/u', '-', $value) ?? $value;

        return trim($value, '-');
    }
}
