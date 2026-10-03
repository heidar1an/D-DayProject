<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * کارت فلش‌کارت — تعریف محتوا، **جدا از وضعیت یادگیری کاربر**.
 *
 * `front`/`back` متن پاک‌سازی‌شده هستند (whitelist سمت سرور). `position` با
 * `UNIQUE(deck_id, position)` ترتیب قطعی می‌دهد.
 */
class Flashcard extends Model
{
    use HasUuids;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'flashcards';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
        ];
    }

    public function deck(): BelongsTo
    {
        return $this->belongsTo(FlashcardDeck::class, 'deck_id');
    }

    /** @return HasMany<FlashcardState, $this> */
    public function states(): HasMany
    {
        return $this->hasMany(FlashcardState::class, 'card_id');
    }

    public function isReviewable(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
