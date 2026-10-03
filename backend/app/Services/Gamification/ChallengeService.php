<?php

namespace App\Services\Gamification;

use App\Models\Challenge;
use App\Models\User;
use App\Models\UserChallenge;
use App\Models\XpTransaction;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * چالش‌های روزانه/هفتگی — فاز ۱۴.
 *
 *   • پیشرفت فقط از فعالیت معتبر بک‌اند می‌آید (`handleActivity`)؛ کلاینت هیچ
 *     endpointی برای تغییر وضعیت چالش ندارد — «completed کردن» از خودِ کاربر
 *     ناممکن است.
 *   • عضویت دورهٔ زمانی lazy است: اولین فعالیت، رکورد دورهٔ جاری را می‌سازد
 *     (UNIQUE کاربر+چالش+دوره؛ مسابقه ⇒ گرفتن Unique و ادامه).
 *   • با بستن دوره، XP از `challenges.xp_reward` با request_key یکتای
 *     `challenge_completed:uch:{id}` صادر می‌شود — پس تکرارِ رسیدن به هدف
 *     در همان دوره دوباره پاداش نمی‌دهد.
 */
class ChallengeService
{
    public function __construct(
        private readonly XpService $xp,
    ) {}

    /**
     * ثبت یک واحد فعالیت معتبر برای همهٔ چالش‌های فعالِ همان metric.
     */
    public function handleActivity(string $userId, string $metric, int $amount = 1, ?Carbon $now = null): void
    {
        if ($amount <= 0) {
            return;
        }

        $now ??= Carbon::now();

        $challenges = Challenge::query()
            ->where('status', Challenge::STATUS_ACTIVE)
            ->where('metric', $metric)
            ->get();

        foreach ($challenges as $challenge) {
            $this->progress($userId, $challenge, $amount, $now);
        }
    }

    private function progress(string $userId, Challenge $challenge, int $amount, Carbon $now): void
    {
        $periodKey = $this->periodKey($challenge, $now);

        DB::transaction(function () use ($userId, $challenge, $amount, $periodKey): void {
            $userChallenge = $this->findOrCreate($userId, $challenge, $periodKey);

            /* دورهٔ بسته‌شده دوباره پاداش نمی‌دهد. */
            if ($userChallenge->status === UserChallenge::STATUS_COMPLETED) {
                return;
            }

            $progress = min((int) $challenge->target, (int) $userChallenge->progress + $amount);
            $completed = $progress >= (int) $challenge->target;

            $userChallenge->forceFill([
                'progress' => $progress,
                'status' => $completed ? UserChallenge::STATUS_COMPLETED : UserChallenge::STATUS_ACTIVE,
                'completed_at' => $completed ? now() : null,
            ])->save();

            if ($completed) {
                $this->xp->award(
                    User::query()->findOrFail($userId),
                    XpTransaction::SOURCE_CHALLENGE_COMPLETED,
                    'uch:'.$userChallenge->getKey(),
                    deltaOverride: (int) $challenge->xp_reward,
                );
            }
        });
    }

    private function findOrCreate(string $userId, Challenge $challenge, string $periodKey): UserChallenge
    {
        $userChallenge = UserChallenge::query()
            ->where('user_id', $userId)
            ->where('challenge_id', $challenge->getKey())
            ->where('period_key', $periodKey)
            ->first();

        if ($userChallenge !== null) {
            return $userChallenge;
        }

        try {
            /* savepoint + گرفتن استثنا بیرون — این متد داخل تراکنش `progress`
               صدا زده می‌شود و بدون savepoint کل آن تراکنش در PG abort می‌شد. */
            return DB::transaction(function () use ($userId, $challenge, $periodKey): UserChallenge {
                $userChallenge = new UserChallenge;
                $userChallenge->forceFill([
                    'user_id' => $userId,
                    'challenge_id' => $challenge->getKey(),
                    'period_key' => $periodKey,
                    'status' => UserChallenge::STATUS_ACTIVE,
                    'progress' => 0,
                ])->save();

                return $userChallenge;
            });
        } catch (UniqueConstraintViolationException) {
            return UserChallenge::query()
                ->where('user_id', $userId)
                ->where('challenge_id', $challenge->getKey())
                ->where('period_key', $periodKey)
                ->firstOrFail();
        }
    }

    /** باکت دوره از ساعت سرور — روزانه `2026-10-03`، هفتگی `2026-W41`. */
    public function periodKey(Challenge $challenge, Carbon $now): string
    {
        return $challenge->isDaily()
            ? $now->toDateString()
            : $now->format('o-\WW');
    }

    /**
     * انقضای تنبل: رکوردهای فعالِ دوره‌های گذشته در خواندن، expired می‌شوند
     * (بدون پاداش). مقایسهٔ رشته‌ای امن است چون هر دو شکل zero-paddedند.
     */
    public function expireStale(string $userId, ?Carbon $now = null): int
    {
        $now ??= Carbon::now();

        return UserChallenge::query()
            ->where('user_id', $userId)
            ->where('status', UserChallenge::STATUS_ACTIVE)
            ->where(function ($query) use ($now): void {
                $query->where(function ($daily) use ($now): void {
                    $daily->whereIn('challenge_id', Challenge::query()->select('id')->where('kind', Challenge::KIND_DAILY))
                        ->where('period_key', '<', $now->toDateString());
                })->orWhere(function ($weekly) use ($now): void {
                    $weekly->whereIn('challenge_id', Challenge::query()->select('id')->where('kind', Challenge::KIND_WEEKLY))
                        ->where('period_key', '<', $now->format('o-\WW'));
                });
            })
            ->update(['status' => UserChallenge::STATUS_EXPIRED]);
    }

    /** فهرست چالش کاربر برای /me/challenges. */
    public function forUser(string $userId, ?Carbon $now = null): array
    {
        $now ??= Carbon::now();
        $this->expireStale($userId, $now);

        $definitions = Challenge::query()->where('status', Challenge::STATUS_ACTIVE)->orderBy('kind')->get();
        $mine = UserChallenge::query()
            ->where('user_id', $userId)
            ->whereIn('period_key', [$now->toDateString(), $now->format('o-\WW')])
            ->get()
            ->keyBy('challenge_id');

        return $definitions->map(function (Challenge $challenge) use ($mine): array {
            $userChallenge = $mine->get($challenge->getKey());

            return [
                'id' => $challenge->getKey(),
                'code' => $challenge->code,
                'name' => $challenge->name,
                'description' => $challenge->description,
                'kind' => $challenge->kind,
                'metric' => $challenge->metric,
                'target' => (int) $challenge->target,
                'xp_reward' => (int) $challenge->xp_reward,
                'status' => $userChallenge?->status ?? 'available',
                'progress' => (int) ($userChallenge?->progress ?? 0),
                'completed_at' => $userChallenge?->completed_at?->toIso8601String(),
            ];
        })->all();
    }
}
