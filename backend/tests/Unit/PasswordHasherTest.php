<?php

namespace Tests\Unit;

use App\Services\Identity\PasswordHasher;
use Tests\TestCase;

class PasswordHasherTest extends TestCase
{
    private const PASSWORD = 'Tapesh#1402';

    private const SCRYPT_FIXTURE = 'scrypt$00112233445566778899aabbccddeeff$'
        .'20846b6bf007f2fee7b28143235ad690f73ba53f95a7327a582920162f965ad91'
        .'ef3a37f0a8616a229f061be269ac2137b8cb91c0c19b07142b2a1656e22c2f6';

    private function hasher(): PasswordHasher
    {
        return app(PasswordHasher::class);
    }

    public function test_it_hashes_with_argon2id_and_verifies_it(): void
    {
        $hash = $this->hasher()->hash(self::PASSWORD);

        $this->assertStringStartsWith('$argon2id$', $hash);
        $this->assertSame(PasswordHasher::ARGON2ID, $this->hasher()->algorithm($hash));
        $this->assertTrue($this->hasher()->verify(self::PASSWORD, $hash));
        $this->assertFalse($this->hasher()->verify('wrong-password', $hash));
        $this->assertFalse($this->hasher()->needsRehash($hash));
    }

    public function test_it_uses_a_fresh_salt_every_time(): void
    {
        $first = $this->hasher()->hash(self::PASSWORD);
        $second = $this->hasher()->hash(self::PASSWORD);

        $this->assertNotSame($first, $second);
        $this->assertTrue($this->hasher()->verify(self::PASSWORD, $first));
        $this->assertTrue($this->hasher()->verify(self::PASSWORD, $second));
    }

    public function test_it_verifies_a_legacy_sha256_hash_and_requests_a_rehash(): void
    {
        $stored = hash('sha256', self::PASSWORD);

        $this->assertSame(PasswordHasher::SHA256, $this->hasher()->algorithm($stored));
        $this->assertTrue($this->hasher()->verify(self::PASSWORD, $stored));
        $this->assertFalse($this->hasher()->verify('nope', $stored));
        $this->assertTrue($this->hasher()->needsRehash($stored));
    }

    public function test_it_verifies_a_legacy_scrypt_hash_and_requests_a_rehash(): void
    {
        $this->assertSame(PasswordHasher::SCRYPT, $this->hasher()->algorithm(self::SCRYPT_FIXTURE));
        $this->assertTrue($this->hasher()->verify(self::PASSWORD, self::SCRYPT_FIXTURE));
        $this->assertFalse($this->hasher()->verify('nope', self::SCRYPT_FIXTURE));
        $this->assertTrue($this->hasher()->needsRehash(self::SCRYPT_FIXTURE));
    }

    public function test_it_verifies_a_bcrypt_hash_with_the_bcrypt_driver(): void
    {
        $stored = password_hash(self::PASSWORD, PASSWORD_BCRYPT, ['cost' => 4]);

        $this->assertSame(PasswordHasher::BCRYPT, $this->hasher()->algorithm((string) $stored));
        $this->assertTrue($this->hasher()->verify(self::PASSWORD, (string) $stored));
        $this->assertTrue($this->hasher()->needsRehash((string) $stored));
    }

    public function test_it_never_throws_on_malformed_stored_hashes(): void
    {
        $malformed = [
            '',
            'not-a-hash',
            'scrypt$zz$zz',
            'scrypt$00$0',
            '$argon2id$broken',
            '$2y$broken',
            str_repeat('a', 63),
            str_repeat('a', 65),
        ];

        foreach ($malformed as $stored) {
            $this->assertFalse(
                $this->hasher()->verify(self::PASSWORD, $stored),
                "malformed hash must not verify: {$stored}",
            );
        }

        $this->assertSame(PasswordHasher::UNKNOWN, $this->hasher()->algorithm('weird'));
    }

    public function test_a_sha256_hash_is_only_accepted_in_lowercase_hex(): void
    {
        $upper = mb_strtoupper(hash('sha256', self::PASSWORD));

        // فرمت legacy دقیقاً ۶۴ hex کوچک است؛ چیز دیگری «هش ناشناخته» است.
        $this->assertSame(PasswordHasher::UNKNOWN, $this->hasher()->algorithm($upper));
        $this->assertFalse($this->hasher()->verify(self::PASSWORD, $upper));
    }
}
