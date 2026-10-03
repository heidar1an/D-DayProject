<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * یک قدم از برنامهٔ مسیر سبز (فاز ۱۳).
 *
 * وضعیت‌ها **سمت سرور** تعیین می‌شوند؛ `recommended` نشانِ قدم پیشنهادی فعلی است
 * (فقط یکی در هر مسیر) و گذارهایش همان خانوادهٔ available است.
 *
 * گذارهای مجاز از درخواست کاربر (تنها دو مورد):
 *     available|recommended → in_progress
 *     in_progress → completed     (فقط kind = action)
 * گذار به completed برای lesson/question/exam فقط توسط موتور، از رخداد واقعی
 * یادگیری انجام می‌شود — کلاینت هرگز نمی‌تواند قدم محتوایی را «تکمیل» کند.
 */
class GreenPathStep extends Model
{
    use HasUuids;

    public const KIND_LESSON = 'lesson';

    public const KIND_QUESTION = 'question';

    public const KIND_EXAM = 'exam';

    public const KIND_ACTION = 'action';

    public const STATUS_LOCKED = 'locked';

    public const STATUS_AVAILABLE = 'available';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_RECOMMENDED = 'recommended';

    public const SOURCE_PLAN = 'plan';

    public const SOURCE_CARRY_OVER = 'carry_over';

    protected $table = 'green_path_steps';

    /**
     * هیچ‌کدام از شناسه‌ها/مالکیت/نسخه از درخواست خوانده نمی‌شوند.
     *
     * @var list<string>
     */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'version' => 'integer',
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function path(): BelongsTo
    {
        return $this->belongsTo(GreenPath::class, 'path_id');
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    /** آیا تکمیل این قدم فقط از رخداد واقعی یادگیری ممکن است؟ */
    public function completionIsDerived(): bool
    {
        return $this->kind !== self::KIND_ACTION;
    }

    /** گذارهای مجاز از سمت کاربر — مرجع واحد برای سرویس و تست. */
    public static function userTransitions(): array
    {
        return [
            self::STATUS_AVAILABLE => [self::STATUS_IN_PROGRESS],
            self::STATUS_RECOMMENDED => [self::STATUS_IN_PROGRESS],
            self::STATUS_IN_PROGRESS => [self::STATUS_COMPLETED],
        ];
    }

    /** گذارهای موتور (رخداد واقعی یادگیری) — تکمیل مستقیم حتی از locked. */
    public static function engineTransitions(): array
    {
        return [
            self::STATUS_LOCKED => [self::STATUS_AVAILABLE, self::STATUS_COMPLETED],
            self::STATUS_AVAILABLE => [self::STATUS_RECOMMENDED, self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED],
            self::STATUS_RECOMMENDED => [self::STATUS_AVAILABLE, self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED],
            self::STATUS_IN_PROGRESS => [self::STATUS_COMPLETED],
        ];
    }
}
