<?php

namespace App\Models;

use Database\Factories\ChapterFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** فصل — فرزند `Course`. */
class Chapter extends Model
{
    /** @use HasFactory<ChapterFactory> */
    use HasFactory, HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'chapters';

    /** @var list<string> */
    protected $fillable = ['course_id', 'slug', 'title', 'description', 'sort_order', 'status'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** @return HasMany<Lesson, $this> */
    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class)->orderBy('sort_order')->orderBy('id');
    }
}
