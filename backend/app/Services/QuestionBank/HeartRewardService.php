<?php

namespace App\Services\QuestionBank;

use App\Models\HeartReward;
use App\Models\QuestionAttempt;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * پاداش قلب — تنها نویسندهٔ `heart_rewards`.
 *
 * قاعده (آینهٔ legacy): «برای هر سؤال، حداکثر یک قلب در روز سرور».
 * کلید = `<questionId>:<floor(now / 86400)>` ⇒ Replay همان پاسخ در همان روز هیچ
 * پاداشی تولید نمی‌کند، مستقل از هر ورودی کلاینت.
 *
 * مقدار پاداش **از کلاینت گرفته نمی‌شود**؛ از config می‌آید. اگر روزی سیستم
 * قلب واقعی مشخص شود (قواعد بیشتر/کمتر بر اساس دشواری)، همین کلاس تنها جایی است
 * که تغییر می‌کند.
 *
 * ⚠️ قلب ≠ XP. XP در فاز ۱۲ (`xp_transactions`) خواهد بود.
 */
class HeartRewardService
{
    private const DAY_SECONDS = 86400;

    /**
     * @return array{awarded: bool, amount: int}
     */
    public function awardFor(User $user, QuestionAttempt $attempt): array
    {
        if (! $attempt->is_correct) {
            return ['awarded' => false, 'amount' => 0];
        }

        $amount = (int) config('question_bank.hearts.reward_amount');

        if ($amount < 1) {
            return ['awarded' => false, 'amount' => 0];
        }

        $key = $this->attemptKey($attempt->question_id);

        try {
            DB::transaction(function () use ($user, $attempt, $key, $amount): void {
                $reward = new HeartReward;
                $reward->forceFill([
                    'user_id' => $user->getKey(),
                    'question_attempt_id' => $attempt->getKey(),
                    'question_id' => $attempt->question_id,
                    'amount' => $amount,
                    'attempt_key' => $key,
                    'awarded_at' => now(),
                ])->save();
            });

            return ['awarded' => true, 'amount' => $amount];
        } catch (UniqueConstraintViolationException) {
            // همان (کاربر، سؤال، روز) — یکتایی دیتابیس تصمیم گرفته، نه کد.
            return ['awarded' => false, 'amount' => 0];
        }
    }

    public function attemptKey(string $questionId): string
    {
        return $questionId.':'.intdiv(now()->getTimestamp(), self::DAY_SECONDS);
    }
}
