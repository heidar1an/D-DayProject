<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * بازخورد — فاز ۱۶. بدنه plain text؛ Privacy کامل (§50): در کش عمومی، event
 * تحلیلی و Log جایی ندارد. مالک یا کاربر سشن است یا مهمان با ref شفاف.
 */
class Feedback extends Model
{
    use HasUuids;

    public const STATUS_OPEN = 'open';

    public const STATUS_ANSWERED = 'answered';

    public const STATUS_CLOSED = 'closed';

    protected $table = 'feedback';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'user_read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return HasMany<FeedbackReply, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(FeedbackReply::class, 'feedback_id');
    }
}
