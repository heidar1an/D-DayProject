<?php

namespace Tests\Unit\Search;

use App\Support\Search\SearchNormalizer;
use PHPUnit\Framework\TestCase;

/**
 * نرمال‌سازی جست‌وجو — فاز ۱۹ (§35/§42).
 */
final class SearchNormalizerTest extends TestCase
{
    public function test_it_maps_arabic_letters_to_persian(): void
    {
        self::assertSame('کلیه', SearchNormalizer::normalize('كليه'));
        self::assertSame('ی', SearchNormalizer::normalize('ي'));
    }

    public function test_it_turns_half_space_into_a_real_space(): void
    {
        self::assertSame('نیم فاصله', SearchNormalizer::normalize("نیم\u{200C}فاصله"));
        self::assertSame('نیم فاصله', SearchNormalizer::normalize('نیم   فاصله'));
    }

    public function test_it_lowercases_latin_text(): void
    {
        self::assertSame('heart anatomy', SearchNormalizer::normalize('Heart Anatomy'));
    }

    public function test_tokens_drop_single_characters_and_duplicates(): void
    {
        self::assertSame(['کلیه', 'بافت'], SearchNormalizer::tokens('ک کليه بافت کلیه'));
    }

    public function test_tokens_are_capped(): void
    {
        $query = implode(' ', array_map(static fn (int $i): string => "token{$i}", range(1, 40)));

        self::assertCount(10, SearchNormalizer::tokens($query));
    }

    public function test_ts_query_uses_prefix_matching(): void
    {
        self::assertSame('کلیه:* & بافت:*', SearchNormalizer::tsQuery('کلیه بافت'));
    }

    public function test_ts_query_is_null_when_nothing_usable_remains(): void
    {
        self::assertNull(SearchNormalizer::tsQuery('a !!! 1'));
    }

    public function test_ts_query_strips_operators_so_injection_is_impossible(): void
    {
        /* `!`/`&`/`|`/`:` تنها نویسه‌هایی هستند که tsquery را می‌شکنند. */
        self::assertSame('کلیه:*', SearchNormalizer::tsQuery("کلیه' & ! | :*"));
    }

    public function test_like_patterns_are_bounded(): void
    {
        self::assertSame(['%کلیه%', '%بافت%'], SearchNormalizer::likePatterns('کلیه بافت'));
    }

    public function test_snippet_marks_the_excerpt_when_the_token_is_deep(): void
    {
        $text = str_repeat('مقدمه طولانی دربارهٔ مقدمه ', 5).'کلیه در انتها';

        $snippet = SearchNormalizer::snippet($text, ['کلیه'], 40);

        self::assertStringStartsWith('…', $snippet);
        self::assertStringContainsString('کلیه', $snippet);
    }

    public function test_snippet_returns_empty_for_blank_text(): void
    {
        self::assertSame('', SearchNormalizer::snippet('   ', ['کلیه']));
    }
}
