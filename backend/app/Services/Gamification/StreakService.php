<?php

namespace App\Services\Gamification;

use App\Models\Streak;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * زنجیرهٔ روزهای فعال — فاز ۱۴.
 *
 * تنها ورودی مجاز، رخداد معتبر بک‌اند است. باکت روز از ساعت **سرور** ساخته
 * می‌شود (timezone پروژه) و ورودی کلاینت هیچ نقشی ندارد:
 *     امروزِ تکرار   ⇒ بدون تغییر (idempotent)
 *     دیروز         ⇒ +۱
 *     قبل از دیروز  ⇒ ریست به ۱
 */
class StreakService
{
    public function touch(string $userId, string $kind = Streak::KIND_STUDY, ?Carbon $now = null): Streak
    {
        $now ??= Carbon::now();
        $today = $now->toDateString();
        $yesterday = $now->copy()->subDay()->toDateString();

        return DB::transaction(function () use ($userId, $kind, $today, $yesterday): Streak {
            $streak = Streak::query()
                ->where('user_id', $userId)
                ->where('kind', $kind)
                ->lockForUpdate()
                ->first();

            if ($streak === null) {
                $streak = new Streak;
                $streak->forceFill([
                    'user_id' => $userId,
                    'kind' => $kind,
                    'current_count' => 1,
                    'longest_count' => 1,
                    'last_day' => $today,
                ])->save();

                return $streak;
            }

            $lastDay = $streak->last_day?->toDateString();

            if ($lastDay === $today) {
                return $streak; /* همان روز دوباره — هیچ. */
            }

            $current = $lastDay === $yesterday ? (int) $streak->current_count + 1 : 1;
            $longest = max((int) $streak->longest_count, $current);

            $streak->forceFill([
                'current_count' => $current,
                'longest_count' => $longest,
                'last_day' => $today,
            ])->save();

            return $streak;
        });
    }
}
