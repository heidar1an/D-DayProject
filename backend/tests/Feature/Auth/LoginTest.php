<?php

namespace Tests\Feature\Auth;

use App\Models\AuthSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_succeeds_and_rotates_the_session(): void
    {
        $register = $this->register();
        $before = $this->cookiesFrom($register);

        $response = $this->withAuthCookies($register)
            ->postJsonWithOrigin('/api/v1/auth/login', [
                'identity' => '09123456789',
                'password' => 'Tapesh#1402',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.user.phone', '09123456789')
            ->assertJsonStructure(['data' => ['user' => ['id', 'profile']], 'requestId']);

        $after = $this->cookiesFrom($response);
        $this->assertNotSame($before['session'], $after['session']);

        // سشن قبلی باطل شد و یک سشن فعال تازه صادر شد.
        $this->assertSame(1, AuthSession::query()->whereNotNull('revoked_at')->count());
        $this->assertSame(1, AuthSession::query()->whereNull('revoked_at')->count());
    }

    public function test_wrong_password_and_unknown_account_are_indistinguishable(): void
    {
        $this->register();

        $wrong = $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'WrongPass#1',
        ]);

        $unknown = $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09999999999',
            'password' => 'WrongPass#1',
        ]);

        $wrong->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
        $unknown->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');

        $this->assertSame($wrong->json('error.message'), $unknown->json('error.message'));
        $this->assertSame($wrong->json('error.fields'), $unknown->json('error.fields'));
    }

    public function test_login_accepts_email_case_insensitively(): void
    {
        $this->register(['phone' => null, 'email' => 'User@Example.com']);

        $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => 'USER@example.COM',
            'password' => 'Tapesh#1402',
        ])->assertStatus(200);
    }

    public function test_login_accepts_the_legacy_phone_field_name(): void
    {
        $this->register();

        $this->postJsonWithOrigin('/api/v1/auth/login', [
            'phone' => '09123456789',
            'password' => 'Tapesh#1402',
        ])->assertStatus(200);
    }

    public function test_a_google_only_account_cannot_log_in_with_a_password(): void
    {
        User::factory()->withoutPassword()->create(['phone' => '09121111111']);

        $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09121111111',
            'password' => 'Tapesh#1402',
        ])->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
    }

    public function test_it_rejects_requests_without_credentials(): void
    {
        $this->postJsonWithOrigin('/api/v1/auth/login', [])->assertStatus(422);

        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789'])
            ->assertStatus(422);
    }

    public function test_a_failed_login_creates_no_session(): void
    {
        $this->register();
        $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'WrongPass#1',
        ])->assertStatus(401);

        $this->assertSame(0, AuthSession::query()->whereNotNull('revoked_at')->count());
        $this->assertSame(1, AuthSession::query()->count());
    }
}
