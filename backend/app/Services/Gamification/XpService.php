<?php

namespace App\Services\Gamification;

use App\Models\LeagueMembership;
use App\Models\LeagueSeason;
use App\Models\User;
use App\Models\XpTransaction;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * دفتر کل XP — تنها نویسندهٔ `xp_transactions` (فاز ۱۴).
 *
 * قواعد:
 *   • دلتا **هرگز** از کلاینت نمی‌آید؛ یا از `config('gamification.xp_rules')`
 *     محاسبه می‌شود یا برای چالش از `challenges.xp_reward`. کلید request هم
 *     همیشه سمت سرور ساخته می‌شود (`{source_type}:{source_id}`).
 *   • Idempotency روی UNIQUE(request_key) دیتابیس سوار است: دو درخواست
 *     هم‌زمان با یک رویداد ⇒ یکی insert می‌شود و دیگری با گرفتن Unique
 *     به «از قبل اعمال‌شده» ترجمه می‌شود. XP دوبار اعمال نمی‌شود.
 *   • `league_memberships.xp_total` projection است و در **همان تراکنش** با
 *     row-lock به‌روز می‌شود تا دو رخداد هم‌زمان projection را خراب نکنند.
 *   • رخداد بدون فصل فعال (که lazy ساخته می‌شود) تراکنش بی‌فصل ثبت می‌کند.
 */
class XpService
{
    public function __construct(
        private readonly LeagueService $league,
    ) {}

    /**
     * اعمال یک رخداد امتیازآور.
     *
     * @return array{transaction: ?XpTransaction, awarded: bool}
     */
    public function award(User $user, string $sourceType, string $sourceId, ?int $deltaOverride = null): array
    {
        $delta = $deltaOverride ?? (int) config('gamification.xp_rules.'.$sourceType, 0);

        if ($delta <= 0) {
            return ['transaction' => null, 'awarded' => false];
        }

        $season = $this->league->ensureCurrent();
        $requestKey = $sourceType.':'.$sourceId;

        return DB::transaction(function () use ($user, $season, $sourceType, $sourceId, $delta, $requestKey): array {
            try {
                /* INSERT در تراکنش داخلی (savepoint) و گرفتن استثنا **بیرون** از آن:
                   در PostgreSQL هر دستور شکست‌خورده کل تراکنش جاری را abort می‌کند
                   (`25P02`) و کوئری بعدی می‌ترکد. با savepoint، rollback فقط تا همین
                   نقطه عقب می‌رود و تراکنش بیرونی سالم می‌ماند. */
                $transaction = DB::transaction(function () use ($user, $season, $sourceType, $sourceId, $delta, $requestKey): XpTransaction {
                    $row = new XpTransaction;
                    $row->forceFill([
                        'user_id' => $user->getKey(),
                        'season_id' => $season?->getKey(),
                        'source_type' => $sourceType,
                        'source_id' => $sourceId,
                        'delta' => $delta,
                        'request_key' => $requestKey,
                        'created_at' => now(),
                    ])->save();

                    return $row;
                });
            } catch (UniqueConstraintViolationException) {
                /* همان رویداد قبلاً اعمال شده — replay، نه XP تازه. */
                $transaction = XpTransaction::query()->where('request_key', $requestKey)->first();

                return ['transaction' => $transaction, 'awarded' => false];
            }

            if ($season !== null) {
                $this->projectMembership($season, $user, $delta);
            }

            return ['transaction' => $transaction, 'awarded' => true];
        });
    }

    /**
     * به‌روزرسانی projection امتیاز فصل — همیشه با lockForUpdate روی رکورد
     * عضویت تا دو رخداد هم‌زمان دو سربار ننویسند.
     */
    private function projectMembership(LeagueSeason $season, User $user, int $delta): void
    {
        $membership = LeagueMembership::query()
            ->where('season_id', $season->getKey())
            ->where('user_id', $user->getKey())
            ->lockForUpdate()
            ->first();

        if ($membership === null) {
            try {
                /* savepoint + گرفتن استثنا بیرون (`25P02`). */
                DB::transaction(function () use ($season, $user, $delta): void {
                    $row = new LeagueMembership;
                    $row->forceFill([
                        'season_id' => $season->getKey(),
                        'user_id' => $user->getKey(),
                        'university_id' => $user->profile?->university_id,
                        'xp_total' => $delta,
                    ])->save();
                });

                return;
            } catch (UniqueConstraintViolationException) {
                $membership = LeagueMembership::query()
                    ->where('season_id', $season->getKey())
                    ->where('user_id', $user->getKey())
                    ->lockForUpdate()
                    ->first();
            }
        }

        if ($membership === null) {
            throw new RuntimeException('league_memberships row disappeared under lock.');
        }

        $membership->forceFill(['xp_total' => (int) $membership->xp_total + $delta])->save();
    }
}
