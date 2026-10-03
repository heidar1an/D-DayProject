<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * نشان‌گذاری مقاله توسط کاربر.
 *
 * `UNIQUE(user_id, article_id)` تنها تضمین race-safe است: دو درخواست هم‌زمان
 * یک رکورد می‌سازند، نه دو. مالکیت فقط از سشن می‌آید — هیچ مسیری
 * `userId` نمی‌پذیرد.
 */
class WikiBookmark extends Model
{
    use HasUuids;

    protected $table = 'wiki_bookmarks';

    /** @var list<string> */
    protected $fillable = [];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'article_id');
    }
}
