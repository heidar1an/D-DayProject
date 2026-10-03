<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * ناشر بین‌المللی — فاز ۱۷.
 *
 * موجودیت canonical است: نام/لوگو یک بار اینجا زندگی می‌کند و دوره‌ها فقط با
 * `provider_id` به آن وصل می‌شوند. ویرایش نام یک ناشر، همهٔ کارت‌هایش را
 * عوض می‌کند (همان قاعدهٔ لایهٔ قدیم در `intlCoursesService.withProviders`).
 */
class InternationalProvider extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    public const KIND_UNIVERSITY = 'university';

    public const KIND_MEDIA = 'media';

    public const KIND_JOURNAL = 'journal';

    public const KIND_ORGANIZATION = 'organization';

    /** @var list<string> */
    public const KINDS = [
        self::KIND_UNIVERSITY,
        self::KIND_MEDIA,
        self::KIND_JOURNAL,
        self::KIND_ORGANIZATION,
    ];

    protected $table = 'international_providers';

    /**
     * `$fillable` خالی: هر ستون از سرویس با `forceFill` پر می‌شود تا Mass
     * Assignment در ریشه بسته بماند (همان قاعدهٔ `Media`/`Exam`).
     *
     * @var list<string>
     */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'focus' => 'array',
            'sort_order' => 'integer',
            'marquee_order' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    /** @return HasMany<InternationalCourse, $this> */
    public function courses(): HasMany
    {
        return $this->hasMany(InternationalCourse::class, 'provider_id');
    }

    public function logo(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'logo_media_id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    /** @param Builder<InternationalProvider> $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', self::STATUS_PUBLISHED);
    }
}
