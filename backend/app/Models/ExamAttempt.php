<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * تلاش شرکت در آزمون — فاز ۷.
 *
 * وضعیت‌ها فقط سه مقدار **با نویسندهٔ واقعی** دارند:
 *   `in_progress` → `graded` (پایان عادی/گریس) یا `expired` (انقضای مهلت).
 * گذار معکوس (`graded → in_progress`) در سرویس رد می‌شود و در
 * `config/exam.attempt_transitions` صریح است.
 *
 * `deadline_at` تنها از ساعت سرور محاسبه می‌شود. هیچ ستون زمانی از بدنهٔ
 * درخواست پر نمی‌شود؛ `started_at`/`submitted_at`/`graded_at` همه سرور-ساخته‌اند.
 *
 * `submit_key` برای idempotency پایان است و `UNIQUE ... WHERE NOT NULL` دارد.
 * `version` برای optimistic lock سطح Attempt است.
 */
class ExamAttempt extends Model
{
    use HasUuids;

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_GRADED = 'graded';

    public const STATUS_EXPIRED = 'expired';

    public const REASON_USER = 'user';

    public const REASON_AUTO = 'auto';

    public const REASON_GRACE = 'grace';

    public const REASON_TIMEOUT = 'timeout';

    protected $table = 'exam_attempts';

    /**
     * `user_id`/`guest_id` از سشن می‌آیند، `status`/`version`/`deadline_at` از
     * سرویس. فقط همین‌ها از ورودی قابل پر شدن‌اند.
     *
     * @var list<string>
     */
    protected $fillable = ['exam_id', 'attempt_no', 'submit_reason'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'attempt_no' => 'integer',
            'version' => 'integer',
            'started_at' => 'datetime',
            'deadline_at' => 'datetime',
            'submitted_at' => 'datetime',
            'graded_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * کلید خارجی صریح است: نام پیش‌فرض لاراول از نام مدل ساخته می‌شود
     * (`exam_attempt_id`) ولی ستون واقعی `attempt_id` است.
     *
     * @return HasMany<ExamAnswer, $this>
     */
    public function answers(): HasMany
    {
        return $this->hasMany(ExamAnswer::class, 'attempt_id');
    }

    /**
     * کلید خارجی صریح است (ستون واقعی `attempt_id` است، نه
     * `exam_attempt_id` که لاراول از نام مدل می‌سازد).
     *
     * @return HasOne<ExamResult, $this>
     */
    public function result(): HasOne
    {
        return $this->hasOne(ExamResult::class, 'attempt_id');
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_IN_PROGRESS;
    }

    public function isFinished(): bool
    {
        return $this->status === self::STATUS_GRADED || $this->status === self::STATUS_EXPIRED;
    }

    /** آخرین لحظهٔ مجاز ارسال: مهلت + گریس همان آزمون. */
    public function submissionDeadline(Exam $exam): Carbon
    {
        return $this->deadline_at->copy()->addSeconds((int) $exam->grace_seconds);
    }
}
