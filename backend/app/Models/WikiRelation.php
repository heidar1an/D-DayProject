<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * رابطهٔ بین دو مقاله — پایهٔ «گراف دانش» فاز ۱۱، **نه** گراف واقعی.
 *
 * `kind` یک allowlist است (`config('wiki.relations.kinds')`) که از `RELATIONS`
 * فرانت‌اند استخراج شده. self relation در دیتابیس ممنوع است و
 * `UNIQUE(from,to,kind)` تکرار را می‌بندد.
 */
class WikiRelation extends Model
{
    use HasUuids;

    protected $table = 'wiki_relations';

    /** @var list<string> */
    protected $fillable = [];

    public function fromArticle(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'from_article_id');
    }

    public function toArticle(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'to_article_id');
    }
}
