<?php

namespace App\Models;

use Database\Factories\CourseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** دوره — فرزند `Subject`. */
class Course extends Model
{
    /** @use HasFactory<CourseFactory> */
    use HasFactory, HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'courses';

    /** @var list<string> */
    protected $fillable = ['subject_id', 'slug', 'title', 'description', 'sort_order', 'status'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /** @return HasMany<Chapter, $this> */
    public function chapters(): HasMany
    {
        return $this->hasMany(Chapter::class)->orderBy('sort_order')->orderBy('id');
    }

    /** @param Builder<Course> $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', self::STATUS_PUBLISHED);
    }
}
