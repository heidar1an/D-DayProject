<?php

namespace Tests\Unit;

use App\Services\Identity\Scrypt;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * اعتبارسنجی پیاده‌سازی scrypt با **خروجی واقعی Node**.
 *
 * fixture زیر با همین دستور در Node ساخته شده است:
 *
 *   crypto.scryptSync('Tapesh#1402', Buffer.from('00112233445566778899aabbccddeeff','hex'), 64)
 *
 * اگر این تست سبز نشود، ورود همهٔ کاربران قدیمی می‌شکند.
 */
class ScryptTest extends TestCase
{
    private const SALT_HEX = '00112233445566778899aabbccddeeff';

    private const NODE_FIXTURE = '20846b6bf007f2fee7b28143235ad690f73ba53f95a7327a582920162f965ad91'
        .'ef3a37f0a8616a229f061be269ac2137b8cb91c0c19b07142b2a1656e22c2f6';

    public function test_it_reproduces_the_node_output_exactly(): void
    {
        $derived = Scrypt::derive(
            'Tapesh#1402',
            (string) hex2bin(self::SALT_HEX),
            16384,
            8,
            1,
            64,
        );

        $this->assertSame(self::NODE_FIXTURE, bin2hex($derived));
    }

    public function test_the_output_length_is_respected(): void
    {
        $derived = Scrypt::derive('Tapesh#1402', (string) hex2bin(self::SALT_HEX), 1024, 8, 1, 32);

        $this->assertSame(32, strlen($derived));
    }

    public function test_it_rejects_a_non_power_of_two_n(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Scrypt::derive('x', 'salt', 1000, 8, 1, 64);
    }

    public function test_it_rejects_invalid_r_and_p(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Scrypt::derive('x', 'salt', 1024, 0, 1, 64);
    }
}
