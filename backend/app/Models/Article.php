<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Article — فاز ۱۶. Wiki نیست؛ Domain مستقل (§56).
 *
 * `$fillable` خالی: `status`، `version`، `published_at` و `author_admin_id`
 * هرگز از بدنهٔ درخواست نمی‌آیند.
 */
class Article extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'articles';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ArticleCategory::class, 'category_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'author_admin_id');
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'editor_admin_id');
    }

    /** @return HasMany<ArticleBookmark, $this> */
    public function bookmarks(): HasMany
    {
        return $this->hasMany(ArticleBookmark::class, 'article_id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }
}
