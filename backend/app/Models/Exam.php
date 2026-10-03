<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * آزمون — ریشهٔ دامنهٔ Exam Engine (فاز ۷).
 *
 * دو لایهٔ وضعیت عمداً جدا هستند و نباید قاطی شوند:
 *   • `status` — **چرخهٔ عمر تحت کنترل ادمین** (`draft|scheduled|open|closed|archived`).
 *     تنها منبع تغییرش پنل با مجوز است. `draft` هرگز عمومی نمی‌شود.
 *   • فاز زمانی (`LIVE`/`GRACE`/`RESULTS_AVAILABLE`/…) — **مشتق از ساعت سرور**
 *     و در `ExamPhaseResolver` محاسبه می‌شود. کلاینت هیچ نقشی در تعیین آن ندارد.
 *
 * قوانین query-critical در ستون‌های جدا هستند (`attempt_limit`,
 * `negative_marking`, `duration_minutes`, `result_release_at`, `grace_seconds`)
 * نه داخل JSONB؛ `rules` فقط سیاست‌های غیرپرسشی و versioned را نگه می‌دارد.
 */
class Exam extends Model
{
    use HasUuids;

    public const KIND_QUIZ = 'quiz';

    public const KIND_PERSONAL = 'personal';

    public const KIND_COORDINATED = 'coordinated';

    public const KIND_INTERNATIONAL = 'international';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_OPEN = 'open';

    public const STATUS_CLOSED = 'closed';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'exams';

    /**
     * `status`، `version`، `rules_version`، `published_at` و `legacy_id` عمداً در
     * `$fillable` نیستند: گذار وضعیت و نسخه‌بندی کار سرویس است، نه ورودی درخواست.
     *
     * @var list<string>
     */
    protected $fillable = [
        'slug', 'kind', 'type', 'title', 'short_name', 'description', 'subject_id',
        'opens_at', 'closes_at', 'registration_opens_at', 'registration_closes_at',
        'result_release_at', 'duration_minutes', 'grace_seconds', 'attempt_limit',
        'negative_marking', 'question_count', 'rules', 'meta',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'rules' => 'array',
            'meta' => 'array',
            'opens_at' => 'datetime',
            'closes_at' => 'datetime',
            'registration_opens_at' => 'datetime',
            'registration_closes_at' => 'datetime',
            'result_release_at' => 'datetime',
            'published_at' => 'datetime',
            'duration_minutes' => 'integer',
            'grace_seconds' => 'integer',
            'attempt_limit' => 'integer',
            'negative_marking' => 'float',
            'question_count' => 'integer',
            'rules_version' => 'integer',
            'version' => 'integer',
        ];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'created_by_admin_id');
    }

    /** @return HasMany<ExamQuestion, $this> */
    public function questions(): HasMany
    {
        return $this->hasMany(ExamQuestion::class)->orderBy('position');
    }

    /** @return HasMany<ExamAttempt, $this> */
    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    /** @return HasMany<ExamRegistration, $this> */
    public function registrations(): HasMany
    {
        return $this->hasMany(ExamRegistration::class);
    }

    public function isPublished(): bool
    {
        return $this->status !== self::STATUS_DRAFT && $this->status !== self::STATUS_ARCHIVED;
    }

    public function acceptsRegistrations(): bool
    {
        return $this->status === self::STATUS_SCHEDULED || $this->status === self::STATUS_OPEN;
    }

    /** آزمون‌های قابل نمایش عمومی: پیش‌نویس و آرشیو هرگز. */
    /** @param Builder<Exam> $query */
    public function scopePubliclyVisible(Builder $query): void
    {
        $query->whereNotIn('status', [self::STATUS_DRAFT, self::STATUS_ARCHIVED]);
    }
}
