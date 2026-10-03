<?php

namespace App\Models;

use Database\Factories\QuestionAttemptFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * تلاش روی یک سؤال — **جدا از Exam Attempt** (فاز ۷).
 *
 * معنایش: «کاربر یک سؤال را مستقل از آزمون رسمی پاسخ داد». هیچ نمرهٔ آزمون،
 * هیچ negativeMarking و هیچ رتبه‌ای اینجا نیست.
 *
 * امنیت:
 *   • `is_correct` فقط توسط `QuestionGradingService` نوشته می‌شود و در
 *     `$fillable` نیست.
 *   • `user_id` از سشن می‌آید؛ `guest_id` برای فاز ۷ (آزمونک مهمان) نگه داشته
 *     شده و در این فاز هیچ مسیری آن را پر نمی‌کند. CHECK دیتابیس تضمین می‌کند
 *     دقیقاً یکی از این دو پر باشد.
 *   • `question_version` نسخهٔ سؤالی است که کاربر دیده — پایهٔ snapshot فاز ۷.
 */
class QuestionAttempt extends Model
{
    /** @use HasFactory<QuestionAttemptFactory> */
    use HasFactory, HasUuids;

    protected $table = 'question_attempts';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'question_version' => 'integer',
            'time_spent_sec' => 'integer',
            'answered_at' => 'datetime',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function selectedOption(): BelongsTo
    {
        return $this->belongsTo(QuestionOption::class, 'selected_option_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function heartReward(): HasOne
    {
        return $this->hasOne(HeartReward::class);
    }
}
