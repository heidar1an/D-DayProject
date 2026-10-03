<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * آیتم مرور G5 — فاز ۱۶. فقط Review Item است، نه Flashcard (§35).
 *
 * پیشروی مرحله در سرور انجام می‌شود (ReviewItemService) تا کلاینت نتواند
 * stage/due_at را جعل کند. تاریخچه append-only است (jsonb).
 */
class ReviewItem extends Model
{
    use HasUuids;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_MASTERED = 'mastered';

    protected $table = 'review_items';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'stage' => 'integer',
            'completed_reviews' => 'integer',
            'history' => 'array',
            'learned_at' => 'datetime',
            'last_reviewed_at' => 'datetime',
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isMastered(): bool
    {
        return $this->status === self::STATUS_MASTERED;
    }
}
