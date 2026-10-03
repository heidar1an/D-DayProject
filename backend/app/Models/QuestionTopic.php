<?php

namespace App\Models;

use Database\Factories\QuestionTopicFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * مبحث سؤال — سلسله‌مراتبی (Parent → Child).
 *
 * ساختار از دادهٔ واقعی legacy استخراج شده: `TOPIC_TREE` در
 * `src/services/testBank/mockData.js` برای هر درس یک فهرست «مبحث + زیرمبحث» دارد،
 * و `question.topicPath` همان مسیر است. پس یک جدول خودارجاع کافی است و
 * «path» به‌شکل رشتهٔ denormalized ذخیره نمی‌شود.
 *
 * یکتایی: `(subject_id, parent_id, slug)` + ایندکس یگانهٔ **جزئی** برای گره‌های
 * ریشه (چون NULL در قید UNIQUE یکتا حساب نمی‌شود).
 */
class QuestionTopic extends Model
{
    /** @use HasFactory<QuestionTopicFactory> */
    use HasFactory, HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'question_topics';

    /** @var list<string> */
    protected $fillable = ['subject_id', 'parent_id', 'slug', 'title', 'sort_order', 'status'];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /** @return HasMany<QuestionTopic, $this> */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order')->orderBy('id');
    }
}
