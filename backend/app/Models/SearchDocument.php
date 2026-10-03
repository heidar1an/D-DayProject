<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * SearchDocument — فاز ۱۹.
 *
 * **Projection بازسازپذیر**، نه منبع حقیقت (§20). هر ردیف با
 * `UNIQUE(entity_type, entity_id)` قفل شده و با upsert نوشته می‌شود.
 *
 * ستون `document` در PostgreSQL از نوع `tsvector` و **generated** است، پس در
 * `$fillable`/`casts` نمی‌آید؛ در SQLite متن نرمال‌شده است و `SearchIndexer`
 * آن را می‌نویسد.
 */
class SearchDocument extends Model
{
    use HasUuids;

    protected $table = 'search_documents';

    /** @var list<string> */
    protected $fillable = [];

    public function isPublishedSource(): bool
    {
        return true;
    }
}
