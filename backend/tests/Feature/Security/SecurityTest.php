<?php

namespace Tests\Feature\Security;

use App\Models\AuthSession;
use App\Models\User;
use App\Models\UserProfile;
use App\Services\Identity\IssuedSession;
use App\Services\Identity\SessionCookies;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Response;
use Tests\TestCase;

/**
 * کنترل‌های امنیتی فاز ۲ — این تست‌ها **رگرسیون** هستند: هرکدام یک قاعدهٔ
 * صریح Blueprint را قفل می‌کنند و اگر روزی کسی آن قاعده را بشکند، تست می‌شکند.
 */
class SecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_there_is_no_route_to_read_or_write_another_user(): void
    {
        $victim = User::factory()->create();
        $register = $this->register();
        $this->withAuthCookies($register);

        $attempts = [
            ['GET', '/api/v1/users/'.$victim->getKey()],
            ['PATCH', '/api/v1/users/'.$victim->getKey()],
            ['GET', '/api/v1/me/'.$victim->getKey()],
            ['POST', '/api/v1/users/'.$victim->getKey().'/password'],
            ['PATCH', '/api/v1/users/'.$victim->getKey().'/profile'],
        ];

        foreach ($attempts as [$method, $uri]) {
            $response = $this->json($method, $uri, [], ['Origin' => $this->origin()]);

            $this->assertContains(
                $response->getStatusCode(),
                [404, 405],
                "unexpected status for {$method} {$uri}",
            );
        }
    }

    public function test_no_sensitive_value_ever_appears_in_a_response(): void
    {
        $register = $this->register();
        $cookies = $this->cookiesFrom($register);

        $bodies = [
            (string) $register->getContent(),
            (string) $this->withAuthCookies($register)->getJson('/api/v1/me')->getContent(),
            (string) $this->postJsonWithOrigin('/api/v1/auth/login', [
                'identity' => '09123456789',
                'password' => 'Tapesh#1402',
            ])->getContent(),
            (string) $this->getJson('/api/v1/universities')->getContent(),
        ];

        $session = AuthSession::query()->first();

        foreach ($bodies as $body) {
            $this->assertStringNotContainsString('password_hash', $body);
            $this->assertStringNotContainsString('$argon2id$', $body);
            $this->assertStringNotContainsString('scrypt$', $body);
            $this->assertStringNotContainsString('csrf_hash', $body);
            $this->assertStringNotContainsString('token_hash', $body);
            $this->assertStringNotContainsString($cookies['session'], $body);
            $this->assertStringNotContainsString($cookies['csrf'], $body);

            if ($session !== null) {
                $this->assertStringNotContainsString((string) $session->token_hash, $body);
            }
        }
    }

    public function test_the_user_model_cannot_mass_assign_identity_or_privilege(): void
    {
        $fillable = (new User)->getFillable();

        foreach (['id', 'password_hash', 'google_subject', 'role', 'permissions', 'is_admin', 'entitlement'] as $forbidden) {
            $this->assertNotContains($forbidden, $fillable, "User must not mass-assign {$forbidden}");
        }

        $hidden = (new User)->getHidden();
        $this->assertContains('password_hash', $hidden);
        $this->assertContains('google_subject', $hidden);
    }

    public function test_the_profile_model_cannot_mass_assign_identity_or_privilege(): void
    {
        $fillable = (new UserProfile)->getFillable();

        foreach (['id', 'user_id', 'role', 'permissions', 'password_hash', 'phone', 'email'] as $forbidden) {
            $this->assertNotContains($forbidden, $fillable, "UserProfile must not mass-assign {$forbidden}");
        }
    }

    public function test_unknown_fields_are_not_persisted(): void
    {
        $register = $this->register();

        $this->withAuthCookies($register)
            ->patchJsonWithOrigin('/api/v1/me', [
                'first_name' => 'آریا',
                'admin_note' => 'x',
                'university' => null,
            ], $this->csrfHeader($register))
            ->assertStatus(200);

        $profile = UserProfile::query()->sole();
        $this->assertSame('آریا', $profile->first_name);
        $this->assertArrayNotHasKey('admin_note', $profile->getAttributes());
        $this->assertArrayNotHasKey('role', $profile->getAttributes());
    }

    public function test_the_session_cookie_is_secure_and_httponly_when_configured(): void
    {
        config(['identity.cookies.secure' => true, 'identity.cookies.same_site' => 'strict']);

        $session = new AuthSession;
        $response = app(SessionCookies::class)->attach(
            new Response,
            new IssuedSession('token-value', 'csrf-value', $session),
        );

        $cookies = $response->headers->getCookies();
        $byName = [];

        foreach ($cookies as $cookie) {
            $byName[$cookie->getName()] = $cookie;
        }

        $sessionName = (string) config('identity.cookies.session');
        $csrfName = (string) config('identity.cookies.csrf');

        $this->assertTrue($byName[$sessionName]->isSecure());
        $this->assertTrue($byName[$sessionName]->isHttpOnly());
        $this->assertSame('strict', strtolower((string) $byName[$sessionName]->getSameSite()));
        $this->assertFalse($byName[$csrfName]->isHttpOnly());
    }

    public function test_the_origin_check_cannot_be_bypassed_with_a_referer_only(): void
    {
        $this->register();

        // Referer با هاست مهاجم ⇒ رد
        $this->postJson('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'Tapesh#1402',
        ], ['Referer' => 'https://evil.example/login'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_the_origin_check_accepts_a_matching_referer(): void
    {
        $this->register();

        $this->postJson('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'Tapesh#1402',
        ], ['Referer' => $this->origin().'/login'])
            ->assertStatus(200);
    }

    public function test_error_responses_never_leak_internals(): void
    {
        $response = $this->getJson('/api/v1/me');

        $body = (string) $response->getContent();

        $this->assertStringNotContainsString('Exception', $body);
        $this->assertStringNotContainsString('Stack trace', $body);
        $this->assertStringNotContainsString(base_path(), $body);
        $this->assertStringNotContainsString('vendor/', $body);
    }

    public function test_request_id_is_present_on_success_and_error_responses(): void
    {
        $this->register()->assertHeader('X-Request-Id');
        $this->getJson('/api/v1/me')->assertHeader('X-Request-Id');
        $this->getJson('/api/v1/nope')->assertStatus(404)->assertHeader('X-Request-Id');
    }
}
