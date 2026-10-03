<?php

namespace Tests\Feature;

use App\Exceptions\ApiErrorException;
use App\Models\AuthSession;
use App\Models\University;
use App\Models\User;
use App\Models\UserProfile;
use App\Services\Identity\ProfileService;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * یکپارچگی داده (BluePrint §24).
 *
 * اینجا ثابت می‌شود که تضمین‌ها در **دیتابیس** هستند، نه فقط در کد PHP:
 * CHECK ها و UNIQUE ها باید مستقل از مسیر برنامه جلوی دادهٔ نامعتبر را بگیرند.
 */
class DataIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_is_transactional(): void
    {
        // اگر ساخت پروفایل شکست بخورد، نه کاربر و نه سشن نباید باقی بماند.
        $this->mock(ProfileService::class, function ($mock): void {
            $mock->shouldReceive('createFor')->andThrow(
                ApiErrorException::invalid(['username' => ['USERNAME_MALFORMED']]),
            );
        });

        $this->register(['profile' => ['username' => 'anything']])->assertStatus(422);

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('user_profiles', 0);
        $this->assertDatabaseCount('auth_sessions', 0);
    }

    public function test_the_database_rejects_a_user_without_any_identity(): void
    {
        $this->expectException(QueryException::class);

        $user = new User;
        $user->forceFill(['phone' => null, 'email' => null, 'google_subject' => null]);
        $user->save();
    }

    public function test_the_database_rejects_a_duplicate_phone_even_without_the_service_precheck(): void
    {
        $this->register();

        $this->expectException(UniqueConstraintViolationException::class);

        $user = new User;
        $user->forceFill(['phone' => '09123456789']);
        $user->save();
    }

    public function test_a_user_can_have_only_one_profile(): void
    {
        $this->register();
        $user = User::query()->sole();

        $this->expectException(UniqueConstraintViolationException::class);

        $profile = new UserProfile;
        $profile->user_id = $user->getKey();
        $profile->save();
    }

    public function test_a_session_must_have_exactly_one_principal(): void
    {
        $user = User::factory()->create();

        /*
         * هر نقض عمدی داخل یک تراکنش تودرتو (savepoint) اجرا می‌شود.
         *
         * چرا: روی PostgreSQL هر خطای دستور، تراکنش جاری را abort می‌کند و هر کوئری
         * بعدی `SQLSTATE[25P02] current transaction is aborted` می‌دهد. تست در
         * `RefreshDatabase` داخل یک تراکنش است، پس بدون savepoint، شمارشِ آخرِ همین
         * تست می‌شکند. روی SQLite این تفاوت دیده نمی‌شد.
         */

        // هیچ principalی ⇒ نقض CHECK
        try {
            DB::transaction(fn () => $this->makeSession(userId: null, adminId: null));
            $this->fail('A session without a principal must be rejected.');
        } catch (QueryException) {
            $this->addToAssertionCount(1);
        }

        // هر دو principal ⇒ نقض CHECK
        try {
            DB::transaction(fn () => $this->makeSession(userId: $user->getKey(), adminId: (string) Str::uuid()));
            $this->fail('A session with two principals must be rejected.');
        } catch (QueryException) {
            $this->addToAssertionCount(1);
        }

        $this->assertSame(0, AuthSession::query()->count());
    }

    public function test_a_session_token_hash_is_unique(): void
    {
        $this->register();
        $existing = AuthSession::query()->sole();

        $this->expectException(UniqueConstraintViolationException::class);

        $this->makeSession(userId: $existing->user_id, tokenHash: (string) $existing->token_hash);
    }

    public function test_deleting_a_university_keeps_the_profile_but_clears_the_link(): void
    {
        $register = $this->register();
        $university = University::factory()->create();

        $this->withAuthCookies($register)->patchJsonWithOrigin('/api/v1/me', [
            'university_id' => $university->getKey(),
        ], $this->csrfHeader($register))->assertStatus(200);

        $university->delete();

        $profile = UserProfile::query()->sole();
        $this->assertNull($profile->university_id);
        $this->assertNotNull($profile->fresh());
    }

    public function test_two_concurrent_registrations_cannot_both_win(): void
    {
        // مسیر «race»: pre-check را دور می‌زنیم و مستقیم دو کاربر با یک شماره می‌سازیم.
        $this->register();

        $this->expectException(UniqueConstraintViolationException::class);

        $user = new User;
        $user->forceFill(['phone' => '09123456789']);
        $user->save();
    }

    private function makeSession(?string $userId, ?string $adminId = null, string $tokenHash = ''): AuthSession
    {
        $session = new AuthSession;
        $session->forceFill([
            'principal_type' => $userId !== null ? AuthSession::PRINCIPAL_USER : AuthSession::PRINCIPAL_ADMIN,
            'user_id' => $userId,
            'admin_id' => $adminId,
            'token_hash' => $tokenHash !== '' ? $tokenHash : hash('sha256', bin2hex(random_bytes(16))),
            'csrf_hash' => hash('sha256', bin2hex(random_bytes(16))),
            'expires_at' => now()->addDay(),
        ]);
        $session->save();

        return $session;
    }
}
