<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * وضعیت فعلی یک کاربر نسبت به یک کارت — **mutable**.
 *
 * تنها نویسندهٔ این جدول `FlashcardReviewService` است. کلاینت هرگز `due_at`،
 * `interval_days`، `ease` یا `algorithm_version` را تعیین نمی‌کند (§15 و §46).
 *
 * `algorithm_version` می‌گوید آخرین محاسبه با کدام استراتژی انجام شده؛ پس
 * «آیا این وضعیت با V2 بازمحاسبه شود؟» یک سؤال پاسخ‌پذیر است (§14).
 */
class FlashcardState extends Model
{
    use HasUuids;

    public const STATE_NEW = 'new';

    public const STATE_LEARNING = 'learning';

    public const STATE_REVIEW = 'review';

    public const STATE_RELEARNING = 'relearning';

    public const STATE_MASTERED = 'mastered';

    public const STATE_SUSPENDED = 'suspended';

    public const STATE_ARCHIVED = 'archived';

    protected $table = 'flashcard_states';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'interval_days' => 'float',
            'interval_minutes' => 'integer',
            'ease' => 'float',
            'review_count' => 'integer',
            'lapse_count' => 'integer',
            'correct_count' => 'integer',
            'incorrect_count' => 'integer',
            'learning_step' => 'integer',
            'difficulty' => 'float',
            'stability' => 'float',
            'mastery_score' => 'integer',
            'suspended' => 'boolean',
            'buried_until' => 'datetime',
            'bookmarked' => 'boolean',
            'last_reviewed_at' => 'datetime',
            'version' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(Flashcard::class, 'card_id');
    }

    /** @return HasMany<FlashcardReview, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(FlashcardReview::class, 'state_id');
    }

    /**
     * آیا کارت الان برای مرور واجد شرایط است؟
     *
     * کارت نو همیشه واجد است؛ کارت معلق یا bury‌شده هرگز. این محاسبه سرور است و
     * کلاینت آن را تکرار نمی‌کند.
     *
     * ⚠️ نوع ورودی `CarbonInterface` است، نه `Illuminate\Support\Carbon`:
     * سرویس مرور با `CarbonImmutable` کار می‌کند و `Carbon` mutable زیرکلاس آن
     * نیست. قید نوع باریک‌تر یعنی `progress()` در عمل ۵۰۰ می‌دهد.
     */
    public function isDue(?CarbonInterface $now = null): bool
    {
        $now ??= now();

        if ($this->suspended) {
            return false;
        }

        if ($this->buried_until !== null && $this->buried_until->greaterThan($now)) {
            return false;
        }

        if ($this->state === self::STATE_NEW || $this->due_at === null) {
            return true;
        }

        return $this->due_at->lessThanOrEqualTo($now);
    }
}
