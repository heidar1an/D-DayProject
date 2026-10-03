<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * پاداش قلب — گره‌خورده به یک Question Attempt واقعی.
 *
 * قاعدهٔ legacy (`database/contentStore.js`) عیناً حفظ شده:
 *     attempt_key = "<questionId>:<باکت روز سرور>"      (باکت = floor(now / 24h))
 * یعنی «برای هر سؤال، حداکثر یک قلب در روز»، مستقل از هر ورودی کلاینت.
 * پیش‌تر این کلید از `answeredAt` کلاینت ساخته می‌شد و مهاجم با تغییر آن برای یک
 * پاسخ درست، کلید تازه می‌ساخت. اکنون منبع کلید، ساعت سرور است.
 *
 * ⚠️ قلب با XP/League قاطی نمی‌شود. XP در فاز ۱۲ (Gamification) و در جدول
 * `xp_transactions` خواهد بود؛ اینجا فقط «قلب» است.
 */
class HeartReward extends Model
{
    use HasUuids;

    protected $table = 'heart_rewards';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'awarded_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(QuestionAttempt::class, 'question_attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
