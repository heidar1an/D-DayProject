<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * تاریخچهٔ مرور — **immutable**.
 *
 * این مدل `updated_at` ندارد (`const UPDATED_AT = null`) و سرویس هیچ‌وقت
 * `update`/`delete` روی آن نمی‌زند. هر مرور یک رکورد تازه است؛ تغییر وضعیت در
 * `flashcard_states` اتفاق می‌افتد، نه اینجا (§12).
 *
 * `request_key` یکتا است: همان کلید با payload متفاوت ⇒ ۴۰۹، همان کلید با همان
 * payload ⇒ همان رکورد برگردانده می‌شود.
 */
class FlashcardReview extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $table = 'flashcard_reviews';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'previous_due_at' => 'datetime',
            'next_due_at' => 'datetime',
            'previous_interval_minutes' => 'integer',
            'next_interval_minutes' => 'integer',
            'previous_ease' => 'float',
            'next_ease' => 'float',
            'reviewed_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function state(): BelongsTo
    {
        return $this->belongsTo(FlashcardState::class, 'state_id');
    }
}
