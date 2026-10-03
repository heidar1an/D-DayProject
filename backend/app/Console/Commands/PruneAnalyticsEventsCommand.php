<?php

namespace App\Console\Commands;

use App\Models\AnalyticsEvent;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * پاک‌سازی رویدادهای تحلیلی کهنه — فاز ۸.
 *
 * ⚠️ **فقط `analytics_events` را دست می‌زند.** هرگز به `exam_results`,
 * `exam_attempts`, `learning_progress`, `study_sessions` یا `question_attempts`
 * دست نمی‌زند: آن‌ها منبع حقیقت دامنه‌اند و retention تحلیلی نباید دادهٔ
 * تاریخی/مالی را حذف کند.
 *
 * بازهٔ نگهداری از `config('analytics.retention_days')` می‌آید (نه hardcode).
 *
 * پیش‌فرض **dry-run** است، مطابق قرارداد `data:repair`/`data-restore` پروژه:
 * هیچ حذفی بدون `--apply` انجام نمی‌شود.
 */
class PruneAnalyticsEventsCommand extends Command
{
    protected $signature = 'analytics:prune-events
        {--days= : بازهٔ نگهداری به روز (پیش‌فرض از config)}
        {--limit=5000 : حداکثر تعداد ردیف در هر اجرا}
        {--apply : واقعاً حذف کن (پیش‌فرض: فقط گزارش)}';

    protected $description = 'حذف رویدادهای تحلیلی قدیمی‌تر از بازهٔ نگهداری';

    public function handle(): int
    {
        /* `?:` اینجا غلط است: `--days=0` را بی‌صدا به config برمی‌گرداند. */
        $days = $this->option('days') !== null
            ? (int) $this->option('days')
            : (int) config('analytics.retention_days');
        $limit = max(1, (int) $this->option('limit'));
        $apply = (bool) $this->option('apply');

        if ($days < 1) {
            $this->error('بازهٔ نگهداری باید حداقل ۱ روز باشد.');

            return self::FAILURE;
        }

        $cutoff = Carbon::now()->subDays($days);

        $query = AnalyticsEvent::query()->where('occurred_at', '<', $cutoff);

        $total = (clone $query)->count();

        $this->line(sprintf(
            'رویدادهای قدیمی‌تر از %s: %d ردیف (نگهداری %d روز).',
            $cutoff->toIso8601String(),
            $total,
            $days,
        ));

        if (! $apply) {
            $this->info('[dry-run] چیزی حذف نشد. برای اجرا `--apply` بدهید.');

            return self::SUCCESS;
        }

        $deleted = 0;

        while (true) {
            $batch = AnalyticsEvent::query()
                ->where('occurred_at', '<', $cutoff)
                ->orderBy('occurred_at')
                ->limit($limit)
                ->delete();

            $deleted += $batch;

            if ($batch < $limit) {
                break;
            }
        }

        $this->info("{$deleted} رویداد حذف شد. جداول دامنه دست‌نخورده ماندند.");

        return self::SUCCESS;
    }
}
