<?php

namespace Tests\Feature\Auth;

use App\Models\AuthSession;
use App\Models\University;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_registers_a_user_with_profile_and_session(): void
    {
        $response = $this->register();

        $response->assertStatus(201)
            ->assertJsonPath('data.user.phone', '09123456789')
            ->assertJsonPath('data.user.has_password', true)
            ->assertJsonPath('data.user.google_linked', false)
            ->assertJsonStructure([
                'data' => ['user' => [
                    'id', 'phone', 'email', 'email_verified_at', 'has_password', 'google_linked',
                    'profile' => [
                        'username', 'first_name', 'last_name', 'university_id', 'term', 'grade',
                        'birth_date_jalali', 'gender', 'avatar_key', 'motivations', 'referrals',
                    ],
                    'created_at',
                ]],
                'requestId',
            ]);

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('user_profiles', 1);
        $this->assertDatabaseCount('auth_sessions', 1);
        $this->assertDatabaseHas('users', ['phone' => '09123456789']);
    }

    public function test_it_sets_an_httponly_session_cookie_and_never_leaks_the_raw_token(): void
    {
        $response = $this->register();
        $cookies = $this->cookiesFrom($response);

        $this->assertNotSame('', $cookies['session']);
        $this->assertNotSame('', $cookies['csrf']);

        $sessionCookie = $response->getCookie((string) config('identity.cookies.session'), false);
        $csrfCookie = $response->getCookie((string) config('identity.cookies.csrf'), false);

        $this->assertTrue($sessionCookie->isHttpOnly());
        $this->assertSame('strict', strtolower((string) $sessionCookie->getSameSite()));
        $this->assertFalse($csrfCookie->isHttpOnly());

        $body = (string) $response->getContent();
        $this->assertStringNotContainsString($cookies['session'], $body);
        $this->assertStringNotContainsString($cookies['csrf'], $body);
        $this->assertStringNotContainsString('password_hash', $body);

        // در دیتابیس فقط هش توکن ذخیره شده است.
        $session = AuthSession::query()->sole();
        $this->assertSame(hash('sha256', $cookies['session']), $session->token_hash);
        $this->assertNotSame($cookies['session'], $session->token_hash);
        $this->assertNotNull($session->expires_at);
        $this->assertSame('user', $session->principal_type);
        $this->assertNull($session->revoked_at);
    }

    public function test_it_rejects_a_duplicate_phone_with_409(): void
    {
        $this->register()->assertStatus(201);

        $this->register()
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'USER_ALREADY_EXISTS');
    }

    public function test_it_normalizes_persian_digits_before_uniqueness(): void
    {
        $this->register(['phone' => '09123456789'])->assertStatus(201);

        $this->register(['phone' => '۰۹۱۲۳۴۵۶۷۸۹'])->assertStatus(409);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_it_rejects_a_weak_password_with_a_field_error(): void
    {
        $response = $this->register(['password' => '12345678']);

        $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertContains('PASSWORD_TOO_WEAK', (array) $response->json('error.fields.password'));
        $this->assertDatabaseCount('users', 0);
    }

    public function test_it_rejects_malformed_input(): void
    {
        $this->register(['phone' => 'not-a-phone'])->assertStatus(422);
        $this->register(['phone' => ''])->assertStatus(422);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_role_from_the_client_is_rejected_not_ignored(): void
    {
        $response = $this->register(['role' => 'admin']);

        $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertArrayHasKey('role', (array) $response->json('error.fields'));
        $this->assertDatabaseCount('users', 0);
    }

    public function test_email_registration_normalizes_case(): void
    {
        $this->register(['phone' => null, 'email' => 'User@Example.COM'])->assertStatus(201);
        $this->assertDatabaseHas('users', ['email' => 'user@example.com']);

        $this->register(['phone' => null, 'email' => 'user@example.com'])->assertStatus(409);
    }

    public function test_it_stores_the_initial_profile_with_normalized_values(): void
    {
        $university = University::factory()->create();

        $response = $this->register(['profile' => [
            'first_name' => 'آریا',
            'last_name' => 'حیدریان',
            'username' => 'Aria',
            'university_id' => $university->getKey(),
            'term' => '۳',
            'gender' => 'مرد',
            'motivations' => ['learning'],
            'referrals' => ['telegram'],
        ]]);

        $response->assertStatus(201)
            ->assertJsonPath('data.user.profile.username', 'aria')
            ->assertJsonPath('data.user.profile.term', '3')
            ->assertJsonPath('data.user.profile.first_name', 'آریا')
            ->assertJsonPath('data.user.profile.motivations', ['learning']);

        $this->assertDatabaseHas('user_profiles', [
            'username' => 'aria',
            'term' => '3',
            'university_id' => $university->getKey(),
        ]);
    }

    public function test_it_rejects_an_unknown_university(): void
    {
        $this->register(['profile' => ['university_id' => (string) Str::uuid()]])
            ->assertStatus(422);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_it_never_creates_a_privileged_account(): void
    {
        $this->register(['is_admin' => true, 'permissions' => ['*']])->assertStatus(422);
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('auth_sessions', 0);
    }
}
