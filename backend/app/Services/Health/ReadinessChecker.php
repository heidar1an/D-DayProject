<?php

namespace App\Services\Health;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Probes for GET /api/v1/readyz. Each check returns a machine-readable result;
 * failure details are written to the structured log (with request_id) but are
 * never returned to clients, so responses cannot leak hosts or internals.
 * Database stays the source of truth; Redis is only a dependency for future
 * cache/queue/rate-limit/session use.
 */
class ReadinessChecker
{
    /** @return array{ok: bool, checks: array<string, array<string, string>>} */
    public function run(): array
    {
        $checks = [];

        if (config('api.readyz.database', true)) {
            $checks['database'] = $this->database();
        }

        if (config('api.readyz.redis', true)) {
            $checks['redis'] = $this->redis();
        }

        $ok = collect($checks)->every(fn (array $check) => $check['status'] === 'ok');

        return ['ok' => $ok, 'checks' => $checks];
    }

    /** @return array<string, string> */
    private function database(): array
    {
        try {
            DB::connection()->select('select 1');

            return ['status' => 'ok'];
        } catch (Throwable $e) {
            $this->logFailure('database', $e);

            return ['status' => 'fail', 'reason' => 'database_unavailable'];
        }
    }

    /** @return array<string, string> */
    private function redis(): array
    {
        try {
            $pong = Redis::connection((string) config('api.redis_connection', 'cache'))->ping();

            $ok = is_bool($pong)
                ? $pong
                : str_contains(strtolower((string) $pong), 'pong');

            return $ok
                ? ['status' => 'ok']
                : ['status' => 'fail', 'reason' => 'redis_ping_failed'];
        } catch (Throwable $e) {
            $this->logFailure('redis', $e);

            return ['status' => 'fail', 'reason' => 'redis_unavailable'];
        }
    }

    private function logFailure(string $check, Throwable $e): void
    {
        Log::warning('readiness check failed', [
            'check' => $check,
            'exception_class' => $e::class,
            'exception_message' => $e->getMessage(),
        ]);
    }
}
