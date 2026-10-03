<?php

namespace Tests\Feature\Auth;

use App\Models\AuthSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LogoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_logout_revokes_the_session_server_side_and_clears_the_cookies(): void
    {
        $register = $this->register();

        $response = $this->withAuthCookies($register)
            ->postJsonWithOrigin('/api/v1/auth/logout', [], $this->csrfHeader($register));

        $response->assertStatus(200)->assertJsonPath('data.ok', true);

        // خروج سمت سرور است، نه فقط پاک‌کردن کوکی در مرورگر.
        $session = AuthSession::query()->sole();
        $this->assertNotNull($session->revoked_at);

        $cleared = $response->getCookie((string) config('identity.cookies.session'), false);
        $this->assertNotNull($cleared);
        $this->assertSame('', (string) $cleared->getValue());

        // همان کوکی قدیمی دیگر کار نمی‌کند.
        $this->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_repeated_logout_is_idempotent(): void
    {
        $register = $this->register();
        $csrf = $this->csrfHeader($register);

        $this->withAuthCookies($register)
            ->postJsonWithOrigin('/api/v1/auth/logout', [], $csrf)
            ->assertStatus(200);

        $this->postJsonWithOrigin('/api/v1/auth/logout', [], $csrf)->assertStatus(200);
    }

    public function test_logout_without_a_session_is_not_an_error(): void
    {
        $this->postJsonWithOrigin('/api/v1/auth/logout')->assertStatus(200);
    }

    public function test_logout_requires_the_csrf_header_when_a_session_exists(): void
    {
        $register = $this->register();

        $this->withAuthCookies($register)
            ->postJsonWithOrigin('/api/v1/auth/logout')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'CSRF_FAILED');

        $this->assertNull(AuthSession::query()->sole()->revoked_at);
    }

    public function test_logout_rejects_a_foreign_origin(): void
    {
        $register = $this->register();

        $this->withAuthCookies($register)
            ->postJson('/api/v1/auth/logout', [], [
                'Origin' => 'https://evil.example',
                ...$this->csrfHeader($register),
            ])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        $this->assertNull(AuthSession::query()->sole()->revoked_at);
    }

    public function test_logout_rejects_a_missing_origin(): void
    {
        $this->postJson('/api/v1/auth/logout')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }
}
