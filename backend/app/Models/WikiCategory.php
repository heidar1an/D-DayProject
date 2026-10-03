<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * دستهٔ ویکی — درخت واقعی با `parent_id`.
 *
 * چرخه در سطح سرویس رد می‌شود (`WikiCategoryService::assertNoCycle`) و
 * `parent_id <> id` در سطح دیتابیس. حذف فیزیکی دستهٔ دارای مقاله محدود است؛
 * مسیر درست آرشیو است.
 */
class WikiCategory extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'wiki_categories';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /** @return HasMany<WikiCategory, $this> */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /** @return HasMany<WikiArticle, $this> */
    public function articles(): HasMany
    {
        return $this->hasMany(WikiArticle::class, 'category_id');
    }
}
