<?php

namespace Tests\Feature\Auth;

use App\Models\AuthSession;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * امنیت سشن: انقضا، ابطال، هش‌شدن توکن، rotation و اصلاح سشن منقضی.
 */
class SessionSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_expired_session_is_rejected(): void
    {
        $register = $this->register();
        $this->withAuthCookies($register)->getJson('/api/v1/me')->assertStatus(200);

        AuthSession::query()->sole()->forceFill(['expires_at' => now()->subMinute()])->save();

        $this->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_a_revoked_session_is_rejected(): void
    {
        $register = $this->register();
        $this->withAuthCookies($register)->getJson('/api/v1/me')->assertStatus(200);

        AuthSession::query()->sole()->forceFill(['revoked_at' => now()])->save();

        $this->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_the_raw_token_is_never_stored(): void
    {
        $register = $this->register();
        $token = $this->cookiesFrom($register)['session'];

        $session = AuthSession::query()->sole();

        $this->assertNotSame($token, $session->token_hash);
        $this->assertSame(hash('sha256', $token), $session->token_hash);
        $this->assertStringNotContainsString($token, (string) $session->toJson());
        $this->assertArrayNotHasKey('token_hash', $session->toArray());
        $this->assertArrayNotHasKey('csrf_hash', $session->toArray());
    }

    public function test_every_session_has_an_expiry_and_a_ttl_bound(): void
    {
        $this->register();

        $session = AuthSession::query()->sole();
        $ttl = (int) config('identity.sessions.ttl_minutes');

        $this->assertNotNull($session->expires_at);
        $this->assertTrue($session->expires_at->lessThanOrEqualTo(now()->addMinutes($ttl)->addMinute()));
        $this->assertTrue($session->expires_at->greaterThan(now()->addMinutes($ttl)->subMinute()));
    }

    public function test_session_expiry_slides_forward_on_use(): void
    {
        $register = $this->register();

        // سشن را نزدیک انقضا می‌بریم تا تمدید لغزان فعال شود.
        AuthSession::query()->sole()->forceFill(['expires_at' => now()->addMinutes(5)])->save();

        $this->withAuthCookies($register)->getJson('/api/v1/me')->assertStatus(200);

        $this->assertTrue(AuthSession::query()->sole()->expires_at->greaterThan(now()->addMinutes(60)));
    }

    public function test_last_seen_is_tracked_but_not_on_every_request(): void
    {
        $register = $this->register();
        AuthSession::query()->sole()->forceFill(['last_seen_at' => Carbon::now()->subDay()])->save();

        $this->withAuthCookies($register)->getJson('/api/v1/me')->assertStatus(200);
        $after = AuthSession::query()->sole()->last_seen_at;

        $this->assertTrue($after->greaterThan(Carbon::now()->subMinute()));

        // درخواست دوم (زیر آستانهٔ touch) نباید دوباره بنویسد.
        $this->getJson('/api/v1/me')->assertStatus(200);
        $this->assertEquals($after->timestamp, AuthSession::query()->sole()->last_seen_at->timestamp);
    }

    public function test_login_rotates_the_session_and_invalidates_the_previous_token(): void
    {
        $register = $this->register();
        $old = $this->cookiesFrom($register)['session'];

        $this->withAuthCookies($register)->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'Tapesh#1402',
        ])->assertStatus(200);

        // توکن قدیمی دیگر به هیچ سشن فعالی نمی‌رسد.
        $this->assertNull(AuthSession::query()->where('token_hash', hash('sha256', $old))->active()->first());
    }

    public function test_session_fixation_is_not_possible(): void
    {
        $register = $this->register();
        $attackerToken = $this->cookiesFrom($register)['session'];

        $login = $this->withAuthCookies($register)->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'Tapesh#1402',
        ])->assertStatus(200);

        $newToken = $this->cookiesFrom($login)['session'];

        $this->assertNotSame($attackerToken, $newToken);
        $this->assertSame(1, AuthSession::query()->whereNull('revoked_at')->count());
    }

    public function test_a_session_belongs_to_exactly_one_principal(): void
    {
        $this->register();

        $session = AuthSession::query()->sole();
        $this->assertSame('user', $session->principal_type);
        $this->assertNotNull($session->user_id);
        $this->assertNull($session->admin_id);
    }

    public function test_deleting_a_user_cascades_to_sessions_and_profile(): void
    {
        $this->register();
        $user = User::query()->sole();

        $user->delete();

        $this->assertSame(0, AuthSession::query()->count());
        $this->assertSame(0, UserProfile::query()->count());
    }

    public function test_sessions_are_not_shared_between_users(): void
    {
        $first = $this->register(['phone' => '09120000001']);

        $this->clearClientCookies();
        $this->register(['phone' => '09120000002']);

        // کوکی کاربر دوم نباید هویت کاربر اول را بدهد.
        $this->withAuthCookies($first)->getJson('/api/v1/me')
            ->assertStatus(200)
            ->assertJsonPath('data.user.phone', '09120000001');
    }

    /** پاک‌کردن کوکی‌های تست‌کلاینت بین دو سناریو. */
    private function clearClientCookies(): void
    {
        $this->withUnencryptedCookies([
            (string) config('identity.cookies.session') => '',
            (string) config('identity.cookies.csrf') => '',
        ]);
    }
}
