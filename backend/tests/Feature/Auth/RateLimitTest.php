<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * rate limit — سقف‌ها از `config/identity.php` خوانده می‌شوند، نه hardcode.
 */
class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_is_rate_limited_per_identity_and_ip(): void
    {
        $this->register();

        $max = (int) config('identity.rate_limits.login.max');

        for ($i = 0; $i < $max; $i++) {
            $this->postJsonWithOrigin('/api/v1/auth/login', [
                'identity' => '09123456789',
                'password' => 'Wrong#1234',
            ])->assertStatus(401);
        }

        $response = $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'Wrong#1234',
        ]);

        $response->assertStatus(429)->assertJsonPath('error.code', 'RATE_LIMITED');
        $this->assertTrue($response->headers->has('Retry-After'));
    }

    public function test_a_different_identity_is_not_blocked_by_another_identitys_limit(): void
    {
        $this->register();
        $this->register(['phone' => '09120000002']);

        $max = (int) config('identity.rate_limits.login.max');

        for ($i = 0; $i < $max; $i++) {
            $this->postJsonWithOrigin('/api/v1/auth/login', [
                'identity' => '09123456789',
                'password' => 'Wrong#1234',
            ])->assertStatus(401);
        }

        $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09120000002',
            'password' => 'Tapesh#1402',
        ])->assertStatus(200);
    }

    public function test_register_is_rate_limited(): void
    {
        $max = (int) config('identity.rate_limits.register.max');

        for ($i = 0; $i < $max; $i++) {
            $this->register(['phone' => '0912000'.str_pad((string) (1000 + $i), 4, '0', STR_PAD_LEFT)])
                ->assertStatus(201);
        }

        $this->register(['phone' => '09120009999'])
            ->assertStatus(429)
            ->assertJsonPath('error.code', 'RATE_LIMITED');
    }

    public function test_the_limits_are_configuration_driven(): void
    {
        config(['identity.rate_limits.login.max' => 2]);
        $this->register();

        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => 'Wrong#1'])->assertStatus(401);
        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => 'Wrong#1'])->assertStatus(401);
        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => 'Wrong#1'])->assertStatus(429);
    }

    public function test_the_rate_limit_response_uses_the_standard_error_envelope(): void
    {
        config(['identity.rate_limits.login.max' => 1]);
        $this->register();

        $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => 'Wrong#1'])->assertStatus(401);

        $response = $this->postJsonWithOrigin('/api/v1/auth/login', ['identity' => '09123456789', 'password' => 'Wrong#1']);

        $response->assertStatus(429)->assertJsonStructure(['error' => ['code', 'message', 'fields'], 'requestId']);
    }
}
