<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * نود گراف دانش — فاز ۱۲.
 *
 * نود یک **مفهوم علمی** است (E.coli، انسولین، UTI)، نه یک مقاله. اتصال به ویکی
 * اختیاری و حداکثر یکی است (`wiki_article_id` unique) — مالکیت مقاله همیشه
 * با ویکی است؛ گراف فقط به آن reference دارد (§1/§17 پرامپت فاز).
 *
 * `status` سه مقدار CMS دارد و تنها مسیر عمومی `published` است؛ `draft` و
 * `archived` در هیچ کوئری عمومی گراف دیده نمی‌شوند.
 *
 * `$fillable` خالی است: `status` و `wiki_article_id` هرگز مستقیم از بدنهٔ
 * درخواست نوشته نمی‌شوند — اولی فقط از publish/archive، دومی فقط پس از
 * اعتبارسنجی وجود/وضعیت مقاله در سرویس.
 */
class KnowledgeNode extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'knowledge_nodes';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [];
    }

    /** @return BelongsTo<WikiArticle, $this> */
    public function wikiArticle(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'wiki_article_id');
    }

    /** @return HasMany<KnowledgeEdge, $this> */
    public function outgoingEdges(): HasMany
    {
        return $this->hasMany(KnowledgeEdge::class, 'from_node_id');
    }

    /** @return HasMany<KnowledgeEdge, $this> */
    public function incomingEdges(): HasMany
    {
        return $this->hasMany(KnowledgeEdge::class, 'to_node_id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }
}
