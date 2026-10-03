<?php

namespace App\Services\Ai;

use App\Exceptions\ApiErrorException;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Caller holds a transaction and a row lock on users.id during reserve/release. */
final class AiQuota
{
    public function reserve(User $user): string
    {
        $max = (int) config('ai.quota.daily_requests');
        if ($max <= 0) {
            throw ApiErrorException::forbidden('AI quota is not configured.');
        }

        $date = now()->utc()->toDateString();
        $row = DB::table('ai_daily_usage')->where('user_id', $user->getKey())->where('usage_date', $date)->first();
        if ((int) ($row->reserved ?? 0) >= $max) {
            throw new ApiErrorException('AI_QUOTA_EXCEEDED', 429, 'AI daily quota exceeded.', [], ['Retry-After' => (string) max(1, now()->utc()->diffInSeconds(now()->utc()->addDay()->startOfDay()))]);
        }

        if ($row === null) {
            DB::table('ai_daily_usage')->insert(['user_id' => $user->getKey(), 'usage_date' => $date, 'reserved' => 1]);
        } else {
            DB::table('ai_daily_usage')->where('user_id', $user->getKey())->where('usage_date', $date)->update(['reserved' => (int) $row->reserved + 1]);
        }

        return $date;
    }

    public function release(User $user, string $date): void
    {
        DB::table('ai_daily_usage')->where('user_id', $user->getKey())->where('usage_date', $date)->where('reserved', '>', 0)->decrement('reserved');
    }
}
