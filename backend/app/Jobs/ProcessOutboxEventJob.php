<?php

namespace App\Jobs;

use App\Services\Outbox\OutboxPublisher;
use Illuminate\Support\Facades\Log;

/**
 * اجرای یک رخداد Outbox — فاز ۱۹.
 *
 * فقط `eventId` حمل می‌شود؛ خود رخداد از دیتابیس خوانده می‌شود (§8). اگر Job
 * دوبار تحویل شود، `OutboxPublisher::process` رخداد منتشرشده را دوباره اجرا
 * نمی‌کند (§13).
 */
final class ProcessOutboxEventJob extends TapeshJob
{
    public function __construct(
        private readonly string $eventId,
    ) {
        parent::__construct();
    }

    protected function policyKey(): string
    {
        return 'outbox';
    }

    protected function queueName(): string
    {
        return (string) config('outbox.queue', 'outbox');
    }

    public function handle(OutboxPublisher $publisher): void
    {
        $startedAt = microtime(true);
        $result = $publisher->process($this->eventId);

        Log::info('outbox.processed', [
            'event_id' => $this->eventId,
            'status' => $result,
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);
    }
}
