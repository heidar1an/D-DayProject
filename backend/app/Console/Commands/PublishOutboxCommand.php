<?php

namespace App\Console\Commands;

use App\Services\Outbox\OutboxPublisher;
use Illuminate\Console\Command;

/**
 * انتشار رخدادهای Outbox — فاز ۱۹ (§14).
 *
 * Sweeper: رخدادهایی که مسیر «dispatch بلافاصله» را ندیدند (پراسس مرده، صف پاک
 * شده) را برمی‌دارد. این همان چیزی است که Outbox را واقعاً reliable می‌کند.
 *
 * هیچ Business Logic سنگینی اینجا نیست؛ فقط برداشتن و صف‌کردن.
 */
final class PublishOutboxCommand extends Command
{
    protected $signature = 'outbox:publish
        {--batch= : حداکثر رخداد در هر اجرا}
        {--prune : حذف رخدادهای منتشرشدهٔ قدیمی}';

    protected $description = 'انتشار رخدادهای منتشرنشدهٔ Outbox و (اختیاری) پاک‌سازی رخدادهای قدیمی';

    public function handle(OutboxPublisher $publisher): int
    {
        if (! (bool) config('outbox.sweep.enabled', true)) {
            $this->info('outbox sweep is disabled by configuration.');

            return self::SUCCESS;
        }

        $batch = (int) ($this->option('batch') ?: config('outbox.sweep.batch'));

        $published = $publisher->sweep($batch);

        $this->info("queued {$published} outbox event(s).");

        if ($this->option('prune')) {
            $days = (int) config('outbox.retention.published_days');
            $removed = $publisher->prune($days);

            $this->info("pruned {$removed} published event(s) older than {$days} day(s).");
        }

        return self::SUCCESS;
    }
}
