<?php

namespace Tests\Unit;

use App\Support\Content\PersianText;
use Tests\TestCase;

/**
 * نرمال‌سازی متن فارسی/عربی — پایهٔ جست‌وجوی ویکی.
 *
 * بدون این، کاربر «كلیه» را با «ک» عربی تایپ می‌کند و محتوایی که با «ک» فارسی
 * ذخیره شده پیدا نمی‌شود — و کاربر فکر می‌کند محتوا وجود ندارد.
 *
 * ⚠️ این **موتور جست‌وجو نیست**؛ فقط نرمال‌سازی رشته برای `ILIKE` محدود است.
 */
class PersianTextTest extends TestCase
{
    public function test_arabic_letters_are_mapped_to_persian(): void
    {
        $this->assertSame('کتاب', PersianText::normalize('كتاب'));
        $this->assertSame('ی', PersianText::normalize('ي'));
        $this->assertSame('ی', PersianText::normalize('ى'));
        $this->assertSame('ه', PersianText::normalize('ة'));
    }

    public function test_persian_and_arabic_digits_become_ascii(): void
    {
        $this->assertSame('1234567890', PersianText::normalize('۱۲۳۴۵۶۷۸۹۰'));
        $this->assertSame('1234567890', PersianText::normalize('١٢٣٤٥٦٧٨٩٠'));
    }

    public function test_the_zero_width_non_joiner_becomes_a_space(): void
    {
        // «نیم‌فاصله» ⇒ «نیم فاصله»
        $this->assertSame('نیم فاصله', PersianText::normalize("نیم\u{200C}فاصله"));
    }

    public function test_the_tatweel_is_removed_and_whitespace_is_collapsed(): void
    {
        $this->assertSame('a b', PersianText::normalize("a\u{0640}b"));
        $this->assertSame('a b', PersianText::normalize('  a   b  '));
    }

    public function test_search_variants_cover_both_spaced_and_compact_forms(): void
    {
        $this->assertSame(
            ['نیم فاصله', 'نیمفاصله'],
            PersianText::searchVariants("نیم\u{200C}فاصله"),
        );
    }

    public function test_search_variants_normalise_arabic_input_too(): void
    {
        $this->assertSame(['کلیه'], PersianText::searchVariants('كليه'));
    }

    public function test_search_variants_of_an_empty_string_are_empty(): void
    {
        $this->assertSame([], PersianText::searchVariants(''));
        $this->assertSame([], PersianText::searchVariants("  \u{200C} "));
    }

    public function test_a_single_word_yields_only_one_variant(): void
    {
        $this->assertSame(['مغز'], PersianText::searchVariants('مغز'));
    }

    public function test_slugify_keeps_persian_letters_and_joins_with_hyphens(): void
    {
        $this->assertSame('کلیه-و-مغز', PersianText::slugify('کلیه و مغز'));
    }

    public function test_slugify_lowercases_ascii_and_strips_punctuation(): void
    {
        $this->assertSame('article-1-introduction', PersianText::slugify('Article 1: Introduction'));
    }

    public function test_slugify_of_punctuation_only_is_empty(): void
    {
        $this->assertSame('', PersianText::slugify('---'));
        $this->assertSame('', PersianText::slugify('!!!'));
    }

    public function test_slugify_normalises_arabic_letters_first(): void
    {
        // «كتاب» با کاف عربی و «کتاب» با کاف فارسی باید یک slug بدهند.
        $this->assertSame(PersianText::slugify('کتاب'), PersianText::slugify('كتاب'));
        $this->assertSame('کتاب', PersianText::slugify('كتاب'));
    }
}
