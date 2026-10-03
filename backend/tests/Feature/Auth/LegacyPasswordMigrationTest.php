<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Services\Identity\PasswordHasher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * سازگاری رمز عبور با سیستم قدیمی (BluePrint §12).
 *
 * سه فرمت واقعی پروژه تست می‌شوند: scrypt (فرمت فعلی Node)، SHA-256 (فرمت
 * قدیمی‌تر) و Argon2id (فرمت جدید). مهاجرت باید خودکار و شفاف باشد.
 */
class LegacyPasswordMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Tapesh#1402';

    private function hasher(): PasswordHasher
    {
        return app(PasswordHasher::class);
    }

    public function test_a_legacy_sha256_password_logs_in_and_is_upgraded(): void
    {
        $user = User::factory()->withLegacySha256Password(self::PASSWORD)->create(['phone' => '09123456789']);
        $this->assertSame(PasswordHasher::SHA256, $this->hasher()->algorithm($user->password_hash));

        $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => self::PASSWORD,
        ])->assertStatus(200);

        $fresh = $user->fresh();
        $this->assertSame(PasswordHasher::ARGON2ID, $this->hasher()->algorithm($fresh->password_hash));
        $this->assertNotSame($user->password_hash, $fresh->password_hash);
        $this->assertNotNull($fresh->password_updated_at);
    }

    public function test_a_legacy_scrypt_password_logs_in_and_is_upgraded(): void
    {
        $user = User::factory()->withLegacyScryptPassword(self::PASSWORD)->create(['phone' => '09123456789']);
        $this->assertSame(PasswordHasher::SCRYPT, $this->hasher()->algorithm($user->password_hash));

        $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => self::PASSWORD,
        ])->assertStatus(200);

        $this->assertSame(PasswordHasher::ARGON2ID, $this->hasher()->algorithm($user->fresh()->password_hash));
    }

    public function test_a_wrong_legacy_password_is_rejected_and_leaves_the_hash_untouched(): void
    {
        $user = User::factory()->withLegacySha256Password(self::PASSWORD)->create(['phone' => '09123456789']);

        $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'Wrong#1234',
        ])->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');

        $fresh = $user->fresh();
        $this->assertSame($user->password_hash, $fresh->password_hash);
        $this->assertSame(PasswordHasher::SHA256, $this->hasher()->algorithm($fresh->password_hash));
    }

    public function test_the_migration_is_idempotent(): void
    {
        User::factory()->withLegacySha256Password(self::PASSWORD)->create(['phone' => '09123456789']);

        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => self::PASSWORD])->assertStatus(200);
        $firstHash = User::query()->sole()->password_hash;

        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => self::PASSWORD])->assertStatus(200);
        $secondHash = User::query()->sole()->password_hash;

        // بار دوم هش Argon2id دوباره ساخته نمی‌شود (نیازی به rehash نیست).
        $this->assertSame($firstHash, $secondHash);
        $this->assertSame(PasswordHasher::ARGON2ID, $this->hasher()->algorithm($secondHash));
    }

    public function test_the_raw_password_never_reaches_the_log_file(): void
    {
        $logPath = storage_path('logs/api.log');

        User::factory()->withLegacySha256Password(self::PASSWORD)->create(['phone' => '09123456789']);

        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => self::PASSWORD])
            ->assertStatus(200);

        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => 'Another#123'])
            ->assertStatus(401);

        if (file_exists($logPath)) {
            $this->assertStringNotContainsString(self::PASSWORD, (string) file_get_contents($logPath));
            $this->assertStringNotContainsString('Another#123', (string) file_get_contents($logPath));
        }
    }
}
