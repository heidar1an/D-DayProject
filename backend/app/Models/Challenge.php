<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * تعریف چالش (روزانه/هفتگی) — دادهٔ مرجع (فاز ۱۴).
 *
 * `metric` مشخص می‌کند کدام فعالیت معتبر بک‌اند پیشرفت این چالش را می‌سازد و
 * `target`/`xp_reward` قواعد ثابت آن است. وضعیت user هرگز مستقیم completed
 * نمی‌شود؛ سرویس وقتی progress به target رسید، خودش می‌بندد و XP می‌دهد.
 */
class Challenge extends Model
{
    use HasUuids;

    public const KIND_DAILY = 'daily';

    public const KIND_WEEKLY = 'weekly';

    public const METRIC_STEPS_COMPLETED = 'steps_completed';

    public const METRIC_LESSONS_COMPLETED = 'lessons_completed';

    public const METRIC_QUESTIONS_CORRECT = 'questions_correct';

    public const METRIC_EXAMS_FINISHED = 'exams_finished';

    public const METRIC_STUDY_MINUTES = 'study_minutes';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $table = 'challenges';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'target' => 'integer',
            'xp_reward' => 'integer',
        ];
    }

    public function userChallenges(): HasMany
    {
        return $this->hasMany(UserChallenge::class, 'challenge_id');
    }

    public function isDaily(): bool
    {
        return $this->kind === self::KIND_DAILY;
    }
}
