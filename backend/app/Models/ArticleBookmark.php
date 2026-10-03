<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * نشان مقاله — فاز ۱۶. هویت فقط از سشن (§28).
 */
class ArticleBookmark extends Model
{
    use HasUuids;

    protected $table = 'article_bookmarks';

    /** @var list<string> */
    protected $fillable = [];

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'article_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
