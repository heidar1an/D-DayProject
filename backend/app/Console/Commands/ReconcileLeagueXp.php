<?php

namespace App\Console\Commands;

use App\Models\LeagueSeason;
use App\Services\Gamification\LeagueService;
use Illuminate\Console\Command;

/**
 * بازسازی projection امتیاز فصل از دفتر کل — مسیر داخلی (فاز ۱۴).
 *
 * عمداً **هیچ endpoint عمومی ندارد**: تصحیح امتیاز کاری ادمینی/عملیاتی است و
 * فقط روی سرور اجرا می‌شود. منبع حقیقت `xp_transactions` است؛ این فرمان فقط
 * projection (`league_memberships.xp_total`) را با آن هم‌تراز می‌کند.
 */
class ReconcileLeagueXp extends Command
{
    protected $signature = 'gamification:reconcile-xp {--season= : slug فصل مشخص (پیش‌فرض: همهٔ فصل‌ها)}';

    protected $description = 'بازسازی xp_total عضویت‌های لیگ از روی دفتر کل xp_transactions';

    public function handle(LeagueService $league): int
    {
        $slug = $this->option('season');

        $seasons = LeagueSeason::query()
            ->when(is_string($slug) && $slug !== '', fn ($query) => $query->where('slug', $slug))
            ->orderBy('starts_at')
            ->get();

        if ($seasons->isEmpty()) {
            $this->info('no seasons found');

            return self::SUCCESS;
        }

        $fixed = 0;

        foreach ($seasons as $season) {
            $count = $league->reconcileSeason($season);
            $fixed += $count;
            $this->line("{$season->slug}: {$count} membership(s) reconciled");
        }

        $this->info("done — {$fixed} membership(s) fixed");

        return self::SUCCESS;
    }
}
