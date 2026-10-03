<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

/**
 * DoD فاز ۱ — «/healthz پاسخ معتبر» و «/readyz تشخیص خرابی وابستگی».
 * این تست‌ها به هیچ سرویس بیرونی وابسته نیستند (مسیر خرابی با اتصال عمداً
 * نامعتبر ساخته می‌شود)؛ مسیر موفق سرویس‌های واقعی در ServiceIntegrationTest.
 */
class HealthEndpointsTest extends TestCase
{
    public function test_healthz_reports_liveness_without_dependencies(): void
    {
        $response = $this->getJson('/api/v1/healthz');

        $response->assertOk()
            ->assertHeader('X-Request-Id')
            ->assertJson(['status' => 'ok']);

        $this->assertSame(
            $response->headers->get('X-Request-Id'),
            $response->json('requestId'),
        );
        $this->assertArrayNotHasKey('error', $response->json());
    }

    public function test_readyz_is_ok_when_database_check_passes(): void
    {
        config(['api.readyz.database' => true, 'api.readyz.redis' => false]);

        $response = $this->getJson('/api/v1/readyz');

        $response->assertOk();
        $this->assertSame('ok', $response->json('status'));
        $this->assertSame('ok', $response->json('checks.database.status'));

        $checks = $response->json('checks');
        $this->assertArrayNotHasKey('redis', $checks);
    }

    public function test_readyz_reports_503_when_database_is_unreachable(): void
    {
        config([
            'database.default' => 'readyz_fail',
            'database.connections.readyz_fail' => [
                'driver' => 'pgsql',
                'host' => '127.0.0.1',
                'port' => 1,
                'database' => 'tapesh',
                'username' => 'nobody',
                'password' => 'secret-not-to-leak',
                'charset' => 'utf8',
            ],
            'api.readyz.redis' => false,
        ]);
        DB::purge('readyz_fail');

        $response = $this->getJson('/api/v1/readyz');

        $response->assertStatus(503);
        $this->assertSame('unavailable', $response->json('status'));
        $this->assertSame('fail', $response->json('checks.database.status'));
        $this->assertStringNotContainsString('secret-not-to-leak', $response->getContent());
        $this->assertStringNotContainsString('nobody', $response->getContent());
    }

    public function test_readyz_reports_503_when_redis_is_unreachable(): void
    {
        config([
            'api.readyz.database' => false,
            'database.redis.cache.host' => '127.0.0.1',
            'database.redis.cache.port' => 1,
        ]);
        Redis::purge('cache');

        $response = $this->getJson('/api/v1/readyz');

        $response->assertStatus(503);
        $this->assertSame('unavailable', $response->json('status'));
        $this->assertSame('fail', $response->json('checks.redis.status'));
    }
}
