<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * فصل لیگ — بازهٔ رقابت (فاز ۱۴).
 *
 * فصل‌ها lazy و هفته‌ای ساخته می‌شوند (`LeagueService::ensureCurrent`)؛ هیچ
 * season الکی seed نمی‌شود. هیچ کاربری بدون membership معتبر در leaderboard
 * یک فصل ظاهر نمی‌شود.
 */
class LeagueSeason extends Model
{
    use HasUuids;

    public const STATUS_UPCOMING = 'upcoming';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ENDED = 'ended';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'league_seasons';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(LeagueMembership::class, 'season_id');
    }

    public function covers(\DateTimeInterface $at): bool
    {
        return $at >= $this->starts_at && $at < $this->ends_at;
    }
}
