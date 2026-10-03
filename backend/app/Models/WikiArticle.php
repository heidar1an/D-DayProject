<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * مقالهٔ ویکی — فاز ۱۰.
 *
 * `body` متن **پاک‌سازی‌شده** است. `status` سه مقدار دارد و تنها مسیر عمومی
 * `published` است؛ `draft` و `archived` در هیچ کوئری عمومی دیده نمی‌شوند.
 *
 * `version` برای optimistic lock: هر آپدیت نسخه را بالا می‌برد و آپدیت با نسخهٔ
 * کهنه ۴۰۹ می‌گیرد. Revision History کامل در این فاز ساخته نمی‌شود.
 *
 * `$fillable` خالی است: `status`، `version`، `published_at` و `author_admin_id`
 * هرگز از بدنهٔ درخواست نمی‌آیند.
 */
class WikiArticle extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'wiki_articles';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'key_facts' => 'array',
            'keywords' => 'array',
            'read_minutes' => 'integer',
            'popularity' => 'integer',
            'view_count' => 'integer',
            'version' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(WikiCategory::class, 'category_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'author_admin_id');
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'editor_admin_id');
    }

    /** @return HasMany<WikiRelation, $this> */
    public function outgoingRelations(): HasMany
    {
        return $this->hasMany(WikiRelation::class, 'from_article_id');
    }

    /** @return HasMany<WikiRelation, $this> */
    public function incomingRelations(): HasMany
    {
        return $this->hasMany(WikiRelation::class, 'to_article_id');
    }

    /** @return HasMany<WikiBookmark, $this> */
    public function bookmarks(): HasMany
    {
        return $this->hasMany(WikiBookmark::class, 'article_id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }
}
