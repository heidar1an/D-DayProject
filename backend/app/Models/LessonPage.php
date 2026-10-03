<?php

namespace App\Models;

use Database\Factories\LessonPageFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * صفحهٔ درس — واحدی که **پیشرفت** روی آن ثبت می‌شود (فاز ۵).
 *
 * `body` متن خام محتواست و در هیچ Resource این فاز serialize نمی‌شود؛ فاز ۵/۶
 * فقط `id`/`title`/`sort_order` و وضعیت را لازم دارد.
 */
class LessonPage extends Model
{
    /** @use HasFactory<LessonPageFactory> */
    use HasFactory, HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'lesson_pages';

    /** @var list<string> */
    protected $fillable = ['lesson_id', 'slug', 'title', 'body', 'sort_order', 'status'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    /** @return HasMany<LearningProgress, $this> */
    public function progress(): HasMany
    {
        return $this->hasMany(LearningProgress::class);
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }
}
