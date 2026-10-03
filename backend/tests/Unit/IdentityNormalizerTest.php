<?php

namespace Tests\Unit;

use App\Services\Identity\IdentityNormalizer;
use Tests\TestCase;

class IdentityNormalizerTest extends TestCase
{
    private function normalizer(): IdentityNormalizer
    {
        return app(IdentityNormalizer::class);
    }

    public function test_it_converts_persian_and_arabic_digits(): void
    {
        $this->assertSame('1234567890', $this->normalizer()->digits('۱۲۳۴۵۶۷۸۹۰'));
        $this->assertSame('1234567890', $this->normalizer()->digits('١٢٣٤٥٦٧٨٩٠'));
        $this->assertSame('0912', $this->normalizer()->digits(' ۰۹۱۲ '));
    }

    public function test_it_normalizes_phone_numbers_to_one_canonical_form(): void
    {
        $normalizer = $this->normalizer();

        $expected = '09123456789';

        $this->assertSame($expected, $normalizer->phone('09123456789'));
        $this->assertSame($expected, $normalizer->phone('۰۹۱۲۳۴۵۶۷۸۹'));
        $this->assertSame($expected, $normalizer->phone('+98 912 345 6789'));
        $this->assertSame($expected, $normalizer->phone('00989123456789'));
        $this->assertSame($expected, $normalizer->phone('989123456789'));
        $this->assertSame($expected, $normalizer->phone('0912-345-6789'));
        $this->assertSame($expected, $normalizer->phone('  09123456789  '));
    }

    public function test_it_returns_null_for_an_empty_phone(): void
    {
        $this->assertNull($this->normalizer()->phone(null));
        $this->assertNull($this->normalizer()->phone(''));
        $this->assertNull($this->normalizer()->phone('   '));
        $this->assertNull($this->normalizer()->phone('no-digits-here'));
    }

    public function test_it_lowercases_and_trims_email(): void
    {
        $this->assertSame('user@example.com', $this->normalizer()->email(' User@Example.COM '));
        $this->assertNull($this->normalizer()->email('   '));
        $this->assertNull($this->normalizer()->email(null));
    }

    public function test_it_lowercases_username(): void
    {
        $this->assertSame('aria.h', $this->normalizer()->username('Aria.H'));
        $this->assertNull($this->normalizer()->username(''));
    }

    public function test_it_normalizes_term_digits(): void
    {
        $this->assertSame('3', $this->normalizer()->term('۳'));
        $this->assertSame('12', $this->normalizer()->term('۱۲'));
        $this->assertNull($this->normalizer()->term('  '));
    }

    public function test_it_collapses_whitespace_in_free_text(): void
    {
        $this->assertSame('آریا حیدریان', $this->normalizer()->text("آریا   حیدریان\n"));
        $this->assertNull($this->normalizer()->text('   '));
    }

    public function test_it_detects_the_identity_type(): void
    {
        $this->assertSame(['type' => 'phone', 'value' => '09123456789'], $this->normalizer()->identity('۰۹۱۲۳۴۵۶۷۸۹'));
        $this->assertSame(['type' => 'email', 'value' => 'user@example.com'], $this->normalizer()->identity('USER@Example.com'));
        $this->assertSame(['type' => 'unknown', 'value' => ''], $this->normalizer()->identity(''));
        $this->assertSame(['type' => 'unknown', 'value' => ''], $this->normalizer()->identity('not-an-identity'));
        $this->assertSame(['type' => 'unknown', 'value' => ''], $this->normalizer()->identity(null));
    }
}
