<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class MeTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_requests_get_401(): void
    {
        $this->getJson('/api/v1/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_it_returns_the_session_user_with_an_allowlisted_shape(): void
    {
        $register = $this->register();
        $user = User::query()->sole();

        $response = $this->withAuthCookies($register)->getJson('/api/v1/me');

        $response->assertStatus(200)
            ->assertJsonPath('data.user.id', $user->getKey())
            ->assertJsonPath('data.user.phone', '09123456789')
            ->assertJsonPath('data.user.has_password', true)
            ->assertJsonMissingPath('data.user.password_hash')
            ->assertJsonMissingPath('data.user.google_subject')
            ->assertJsonMissingPath('data.user.token')
            ->assertJsonMissingPath('data.user.role')
            ->assertJsonMissingPath('data.user.permissions');

        $this->assertArrayNotHasKey('password_hash', $user->toArray());
        $this->assertArrayNotHasKey('google_subject', $user->toArray());
    }

    public function test_a_user_id_in_the_query_is_ignored_and_cannot_impersonate(): void
    {
        $victim = User::factory()->create(['phone' => '09999999999']);
        $register = $this->register();

        $this->withAuthCookies($register)
            ->getJson('/api/v1/me?userId='.$victim->getKey().'&id='.$victim->getKey())
            ->assertStatus(200)
            ->assertJsonPath('data.user.phone', '09123456789');
    }

    public function test_a_forged_or_expired_session_cookie_is_rejected(): void
    {
        $this->withUnencryptedCookies([
            (string) config('identity.cookies.session') => str_repeat('a', 64),
        ])->getJson('/api/v1/me')->assertStatus(401);

        $this->withUnencryptedCookies([
            (string) config('identity.cookies.session') => 'too-short',
        ])->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_the_session_cookie_is_the_only_source_of_identity(): void
    {
        $register = $this->register();

        // هیچ هدر یا بدنه‌ای نمی‌تواند هویت را عوض کند.
        $this->withAuthCookies($register)
            ->getJson('/api/v1/me', ['X-User-Id' => (string) Str::uuid()])
            ->assertStatus(200)
            ->assertJsonPath('data.user.phone', '09123456789');
    }
}
