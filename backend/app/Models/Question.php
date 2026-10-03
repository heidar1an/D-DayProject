<?php

namespace App\Models;

use Database\Factories\QuestionFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * سؤال — ریشهٔ دامنهٔ بانک سؤال (فاز ۶).
 *
 * امنیت ساختاری: **کلید پاسخ اینجا نیست.** `correct_option_id` و `explanation`
 * فقط در `question_keys` هستند، پس هیچ `select *` روی این جدول نمی‌تواند کلید
 * را لو بدهد. `QuestionResource` عمومی هم هیچ فیلد مدیریتی برنمی‌گرداند.
 *
 * `version` برای snapshot فاز ۷ است: Exam Engine باید بتواند «نسخهٔ سؤالی که
 * دانشجو دیده» را ثابت نگه دارد. تغییر هر فیلد محتوایی نسخه را بالا می‌برد.
 *
 * حذف فیزیکی ممنوع است: `status = archived` جایگزین است. FKهای
 * `question_attempts`/`exam_*` با RESTRICT همین را تحمیل می‌کنند.
 */
class Question extends Model
{
    /** @use HasFactory<QuestionFactory> */
    use HasFactory, HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    /** نوع‌ها — دقیقاً همان مقادیر `QUESTION_TYPES` در UI فعلی. */
    public const TYPES = ['single', 'concept', 'memorization', 'calculation', 'clinical', 'image', 'combined'];

    public const DIFFICULTIES = ['easy', 'medium', 'hard', 'very_hard'];

    public const SOURCES = ['official', 'comprehensive', 'tapesh'];

    public const TRACKS = ['medicine', 'dentistry'];

    protected $table = 'questions';

    /**
     * `version`، `status`، `published_at`، `author_admin_id` و `legacy_id` عمداً
     * در `$fillable` نیستند: انتشار، نسخه‌بندی و مالکیت‌نویسی کار سرویس است، نه
     * ورودی درخواست.
     *
     * @var list<string>
     */
    protected $fillable = [
        'subject_id', 'chapter_id', 'lesson_id', 'topic_id',
        'stem', 'figure_key', 'type', 'difficulty', 'source', 'track',
        'year', 'exam_month',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'year' => 'integer',
            'exam_month' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(Chapter::class);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(QuestionTopic::class, 'topic_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'author_admin_id');
    }

    /** @return HasMany<QuestionOption, $this> */
    public function options(): HasMany
    {
        return $this->hasMany(QuestionOption::class)->orderBy('position')->orderBy('id');
    }

    /** کلید پاسخ — **هرگز** در Resource عمومی serialize نشود. */
    public function key(): HasOne
    {
        return $this->hasOne(QuestionKey::class);
    }

    /** @param Builder<Question> $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', self::STATUS_PUBLISHED);
    }
}
