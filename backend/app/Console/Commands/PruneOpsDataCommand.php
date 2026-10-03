<?php

namespace App\Console\Commands;

use App\Services\Audit\AuditLogger;
use App\Services\Outbox\OutboxPublisher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * پاک‌سازی دادهٔ عملیاتی — فاز ۱۹/۲۰ (§14).
 *
 * چهار گروه، همه **batch-limited** و زمان‌بند-محور:
 *   notifications           خوانده‌شده‌های قدیمی + هر اعلان بسیار قدیمی
 *   outbox_events           منتشرشده‌های قدیمی
 *   audit_logs              قدیمی‌تر از دورهٔ نگهداشت
 *   failed_jobs             dead-letter قدیمی
 *
 * ⚠️ هیچ دادهٔ دامنه‌ای پاک نمی‌شود؛ این‌ها همه projection/operationalاند.
 */
final class PruneOpsDataCommand extends Command
{
    protected $signature = 'ops:prune
        {--notifications : فقط اعلان‌ها}
        {--outbox : فقط رخدادهای Outbox}
        {--audit : فقط Audit log}
        {--failed-jobs : فقط Jobهای شکست‌خورده}';

    protected $description = 'پاک‌سازی batch-limited دادهٔ عملیاتی (اعلان/Outbox/Audit/dead-letter)';

    public function handle(OutboxPublisher $outbox, AuditLogger $audit): int
    {
        $only = array_filter([
            'notifications' => (bool) $this->option('notifications'),
            'outbox' => (bool) $this->option('outbox'),
            'audit' => (bool) $this->option('audit'),
            'failedJobs' => (bool) $this->option('failed-jobs'),
        ]);

        $runAll = $only === [];

        if ($runAll || isset($only['notifications'])) {
            $this->info('notifications pruned: '.$this->pruneNotifications());
        }

        if ($runAll || isset($only['outbox'])) {
            $this->info('outbox events pruned: '.$outbox->prune((int) config('outbox.retention.published_days')));
        }

        if ($runAll || isset($only['audit'])) {
            $this->info('audit logs pruned: '.$audit->prune(
                (int) config('audit.retention.days'),
                (int) config('audit.retention.batch'),
            ));
        }

        if ($runAll || isset($only['failedJobs'])) {
            $this->info('failed jobs pruned: '.$this->pruneFailedJobs());
        }

        return self::SUCCESS;
    }

    private function pruneNotifications(): int
    {
        if (! Schema::hasTable('notifications')) {
            return 0;
        }

        $batch = (int) config('notifications.retention.batch');
        $readDays = (int) config('notifications.retention.read_days');
        $anyDays = (int) config('notifications.retention.any_days');

        $read = DB::table('notifications')
            ->whereNotNull('read_at')
            ->where('read_at', '<', now()->subDays(max(1, $readDays)))
            ->limit(max(1, $batch))
            ->delete();

        $any = DB::table('notifications')
            ->where('created_at', '<', now()->subDays(max(1, $anyDays)))
            ->limit(max(1, $batch))
            ->delete();

        return $read + $any;
    }

    private function pruneFailedJobs(): int
    {
        if (! Schema::hasTable('failed_jobs')) {
            return 0;
        }

        $days = (int) config('queue.tapesh.dead_letter.retention_days');
        $batch = (int) config('queue.tapesh.dead_letter.prune_batch');

        return DB::table('failed_jobs')
            ->where('failed_at', '<', now()->subDays(max(1, $days)))
            ->limit(max(1, $batch))
            ->delete();
    }
}
