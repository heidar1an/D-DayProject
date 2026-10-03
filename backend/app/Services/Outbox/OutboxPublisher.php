<?php

namespace App\Services\Outbox;

use App\Jobs\ProcessOutboxEventJob;
use App\Models\OutboxEvent;
use Illuminate\Support\Facades\Log;

/**
 * انتشار رخدادهای Outbox — فاز ۱۹.
 *
 * دو مسیر:
 *   ۱) بلافاصله بعد از ثبت (از `OutboxService`).
 *   ۲) Sweeper زمان‌بند برای رخدادهایی که مسیر اول را ندیدند (پراسس بین
 *      «insert» و «dispatch» مرده باشد) — همان چیزی که Outbox را واقعاً
 *      reliable می‌کند.
 */
class OutboxPublisher
{
    public function __construct(
        private readonly OutboxHandlerRegistry $handlers,
    ) {}

    /** Sweeper: رخدادهای منتشرنشدهٔ کهنه را بردار و به صف بفرست. */
    public function sweep(int $batch): int
    {
        $maxAgeHours = (int) config('outbox.sweep.max_age_hours');
        $cutoff = now()->subHours(max(1, $maxAgeHours));

        $ids = OutboxEvent::query()
            ->whereNull('published_at')
            ->where('created_at', '>=', $cutoff)
            ->orderBy('created_at')
            ->orderBy('id')
            ->limit(max(1, $batch))
            ->pluck('id')
            ->all();

        foreach ($ids as $id) {
            ProcessOutboxEventJob::dispatch((string) $id);
        }

        return count($ids);
    }

    /**
     * اجرای واقعی یک رخداد. **duplicate-safe**: رخداد منتشرشده دوباره اجرا
     * نمی‌شود، پس redelivery صف اثر دوباره ندارد (§13).
     */
    public function process(string $eventId): string
    {
        $event = OutboxEvent::query()->find($eventId);

        if (! $event instanceof OutboxEvent) {
            return 'missing';
        }

        if ($event->isPublished()) {
            return 'already_published';
        }

        $handler = $this->handlers->for((string) $event->event_type);

        if ($handler === null) {
            $this->recordFailure($event, 'UNKNOWN_EVENT_TYPE');

            /* نوع ناشناخته بی‌صدا گم نمی‌شود: Job fail می‌شود و در
             * `failed_jobs` دیده می‌شود (§10). */
            throw new \RuntimeException('No outbox handler registered for event type: '.$event->event_type);
        }

        try {
            $handler->handle($event);
        } catch (\Throwable $error) {
            $this->recordFailure($event, $this->errorCode($error));

            throw $error;
        }

        $this->markPublished($event);

        return 'published';
    }

    public function markPublished(OutboxEvent $event): void
    {
        OutboxEvent::query()
            ->whereKey($event->getKey())
            ->whereNull('published_at')
            ->update(['published_at' => now(), 'updated_at' => now()]);
    }

    public function recordFailure(OutboxEvent $event, string $code): void
    {
        OutboxEvent::query()
            ->whereKey($event->getKey())
            ->update([
                'attempts' => (int) $event->attempts + 1,
                'last_error_code' => $code,
                'updated_at' => now(),
            ]);
    }

    /** حذف رخدادهای منتشرشدهٔ قدیمی — batch محدود، توسط زمان‌بند. */
    public function prune(int $days): int
    {
        return OutboxEvent::query()
            ->whereNotNull('published_at')
            ->where('published_at', '<', now()->subDays(max(1, $days)))
            ->delete();
    }

    /** کد خطای امن برای dead-letter — بدون پیام خام (ممکن است دادهٔ حساس داشته باشد). */
    private function errorCode(\Throwable $error): string
    {
        Log::warning('outbox.handler_failed', [
            'error' => $error::class,
            'message' => $error->getMessage(),
        ]);

        $short = (new \ReflectionClass($error))->getShortName();

        return mb_substr($short, 0, 64);
    }
}
