<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

/**
 * مسیر موفق سرویس‌های واقعی. بدون سرویس، با skip صریح (و پیام روشن) رد می‌شوند —
 * نه fail و نه ادعای موفقیت صوری. در CI هر دو سرویس فراهم است.
 */
class ServiceIntegrationTest extends TestCase
{
    public function test_postgresql_connection_when_service_available(): void
    {
        $host = (string) env('TAPESH_TEST_PGSQL_HOST');

        if ($host === '') {
            $this->markTestSkipped('PostgreSQL service not provided (set TAPESH_TEST_PGSQL_HOST to run).');
        }

        config(['database.connections.tapesh_pg_test' => [
            'driver' => 'pgsql',
            'host' => $host,
            'port' => (int) env('TAPESH_TEST_PGSQL_PORT', 5432),
            'database' => (string) env('TAPESH_TEST_PGSQL_DB', 'tapesh'),
            'username' => (string) env('TAPESH_TEST_PGSQL_USER', get_current_user()),
            'password' => (string) env('TAPESH_TEST_PGSQL_PASSWORD', ''),
            'charset' => 'utf8',
        ]]);
        DB::purge('tapesh_pg_test');

        $row = DB::connection('tapesh_pg_test')->select('select version() as version')[0];

        $this->assertStringContainsString('PostgreSQL', $row->version);
    }

    public function test_redis_roundtrip_when_service_available(): void
    {
        if (! env('TAPESH_TEST_REDIS')) {
            $this->markTestSkipped('Redis service not provided (set TAPESH_TEST_REDIS=1 to run).');
        }

        $redis = Redis::connection('cache');

        $this->assertPong($redis->ping());

        $redis->set('tapesh:phase1:test', 'ok', 'EX', 10);
        $this->assertSame('ok', $redis->get('tapesh:phase1:test'));
        $redis->del('tapesh:phase1:test');
    }

    private function assertPong(mixed $pong): void
    {
        $ok = is_bool($pong) ? $pong : str_contains(strtolower((string) $pong), 'pong');
        $this->assertTrue($ok, 'Redis ping did not return PONG.');
    }
}
