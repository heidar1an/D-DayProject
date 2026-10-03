<?php

namespace Tests\Unit;

use App\Services\Identity\PasswordPolicy;
use Tests\TestCase;

/**
 * سیاست رمز باید **عیناً** همان رفتار `database/authPolicy.js` در Node باشد،
 * وگرنه رمزی که دیروز معتبر بوده امروز رد می‌شود.
 */
class PasswordPolicyTest extends TestCase
{
    private function policy(): PasswordPolicy
    {
        return app(PasswordPolicy::class);
    }

    public function test_it_accepts_a_reasonable_password(): void
    {
        $this->assertNull($this->policy()->check('Tapesh#1402'));
        $this->assertTrue($this->policy()->isValid('Tapesh#1402'));
    }

    public function test_it_requires_a_non_empty_password(): void
    {
        $this->assertSame('PASSWORD_REQUIRED', $this->policy()->check('')['code']);
        $this->assertSame('PASSWORD_REQUIRED', $this->policy()->check('        ')['code']);
    }

    public function test_it_rejects_control_characters(): void
    {
        $this->assertSame('PASSWORD_MALFORMED', $this->policy()->check("abc\ndefgh")['code']);
    }

    public function test_it_rejects_too_long_and_too_short_passwords(): void
    {
        $max = (int) config('identity.passwords.max_length');
        $min = (int) config('identity.passwords.min_length');

        $this->assertSame('PASSWORD_TOO_LONG', $this->policy()->check(str_repeat('a', $max + 1))['code']);
        $this->assertSame('PASSWORD_TOO_SHORT', $this->policy()->check(str_repeat('a', $min - 1))['code']);
    }

    public function test_it_rejects_digits_only_and_single_character_passwords(): void
    {
        $this->assertSame('PASSWORD_TOO_WEAK', $this->policy()->check('12345678')['code']);
        $this->assertSame('PASSWORD_TOO_WEAK', $this->policy()->check('aaaaaaaa')['code']);
    }

    public function test_it_rejects_common_passwords(): void
    {
        $this->assertSame('PASSWORD_TOO_WEAK', $this->policy()->check('password')['code']);
        $this->assertSame('PASSWORD_TOO_WEAK', $this->policy()->check('tapesh123')['code']);
    }

    public function test_it_measures_length_after_nfkc_normalization(): void
    {
        // «۱۲۳۴۵۶۷۸» با ارقام فارسی: طول واقعی ۸ است، نه کمتر.
        $this->assertSame('PASSWORD_TOO_WEAK', $this->policy()->check('۱۲۳۴۵۶۷۸')['code']);

        // «۱۲۳» فقط سه نویسه است ⇒ کوتاه
        $this->assertSame('PASSWORD_TOO_SHORT', $this->policy()->check('۱۲۳')['code']);
    }

    public function test_the_minimum_length_comes_from_configuration(): void
    {
        config(['identity.passwords.min_length' => 4]);

        $this->assertNull($this->policy()->check('Ab1#'));
        $this->assertSame('PASSWORD_TOO_SHORT', $this->policy()->check('Ab1')['code']);
    }
}
