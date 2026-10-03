<?php

namespace App\Models;

use Database\Factories\LessonFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** درس/واحد — فرزند `Chapter`. */
class Lesson extends Model
{
    /** @use HasFactory<LessonFactory> */
    use HasFactory, HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'lessons';

    /** @var list<string> */
    protected $fillable = ['chapter_id', 'slug', 'title', 'description', 'sort_order', 'status'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(Chapter::class);
    }

    /** @return HasMany<LessonPage, $this> */
    public function pages(): HasMany
    {
        return $this->hasMany(LessonPage::class)->orderBy('sort_order')->orderBy('id');
    }
}
