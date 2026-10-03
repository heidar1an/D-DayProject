<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * دک فلش‌کارت — فاز ۹.
 *
 * `owner_user_id = null` یعنی **دک رسمی TAPESH**؛ غیر null یعنی دک شخصی.
 * CHECK دیتابیس تضمین می‌کند دک رسمی همیشه `visibility = public` باشد.
 *
 * `$fillable` خالی است، عمداً: هیچ فیلدی از بدنهٔ درخواست مستقیماً روی مدل
 * نمی‌نشیند. `owner_user_id` از سشن، `status`/`visibility`/`published_at` از
 * سرویس و `author_admin_id` از سشن ادمین تعیین می‌شوند.
 */
class FlashcardDeck extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    public const VISIBILITY_PRIVATE = 'private';

    public const VISIBILITY_PUBLIC = 'public';

    protected $table = 'flashcard_decks';

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

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'author_admin_id');
    }

    /** @return HasMany<Flashcard, $this> */
    public function cards(): HasMany
    {
        return $this->hasMany(Flashcard::class, 'deck_id');
    }

    /** دک رسمی = بدون مالک. */
    public function isOfficial(): bool
    {
        return $this->owner_user_id === null;
    }

    public function isOwnedBy(User $user): bool
    {
        return $this->owner_user_id !== null
            && (string) $this->owner_user_id === (string) $user->getKey();
    }

    /** دک رسمی منتشرشده برای همه قابل خواندن است. */
    public function isPubliclyReadable(): bool
    {
        return $this->status === self::STATUS_PUBLISHED
            && $this->visibility === self::VISIBILITY_PUBLIC;
    }
}
