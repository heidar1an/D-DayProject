<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * پایهٔ Jobهای فاز ۱۹ — سیاست صف از config، نه hardcode (§6).
 *
 * قواعد ثابت همهٔ Jobهای این فاز (§8):
 *   • فقط **شناسه** حمل می‌کنند، نه آبجکت کامل دامنه.
 *   • هیچ رمز/توکن/سشن در payload نیست (خودِ Job هم سریالایز نمی‌کند).
 *   • retry محدود + backoff نمایی (§9).
 *   • `failed()` لاگ امن می‌نویسد و Job در dead-letter دیده می‌شود (§10).
 */
abstract class TapeshJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [10, 60, 300];

    public int $timeout = 60;

    public function __construct()
    {
        $policy = $this->policy();

        $this->tries = max(1, (int) ($policy['tries'] ?? 3));
        $this->backoff = array_values(array_map('intval', (array) ($policy['backoff'] ?? [10, 60, 300])));
        $this->timeout = max(1, (int) ($policy['timeout'] ?? 60));

        $this->onQueue($this->queueName());
    }

    /** کلید سیاست در `queue.tapesh.policy`. */
    protected function policyKey(): string
    {
        return 'default';
    }

    protected function queueName(): string
    {
        return (string) config('queue.tapesh.queues.default', 'default');
    }

    /** @return array<string, mixed> */
    protected function policy(): array
    {
        return (array) config('queue.tapesh.policy.'.$this->policyKey(), []);
    }

    /**
     * شکست نهایی — فقط کلاس خطا و شناسهٔ امن لاگ می‌شود؛ پیام خام می‌تواند
     * دادهٔ حساس داشته باشد (§44).
     */
    public function failed(Throwable $error): void
    {
        Log::error('job.failed', [
            'job' => static::class,
            'queue' => $this->queue ?? null,
            'attempts' => $this->attempts(),
            'error' => $error::class,
        ]);
    }
}
