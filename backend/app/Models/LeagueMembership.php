<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * عضویت کاربر در فصل — projection امتیاز (فاز ۱۴).
 *
 * `xp_total` **مشتق** است: منبع حقیقت `xp_transactions` است. هر تغییر با
 * `XpService` داخل همان تراکنش دفتر کل اعمال می‌شود و در صورت mismatch،
 * فرمان `gamification:reconcile-xp` از روی دفتر بازمی‌سازد.
 */
class LeagueMembership extends Model
{
    use HasUuids;

    protected $table = 'league_memberships';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'xp_total' => 'integer',
        ];
    }

    public function season(): BelongsTo
    {
        return $this->belongsTo(LeagueSeason::class, 'season_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(XpTransaction::class, 'season_id', 'season_id')
            ->where('user_id', $this->user_id);
    }
}
