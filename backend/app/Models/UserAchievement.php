<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * بازشدن یک نشان برای کاربر — UNIQUE(user_id, achievement_id) (فاز ۱۴).
 */
class UserAchievement extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'user_achievements';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'unlocked_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function achievement(): BelongsTo
    {
        return $this->belongsTo(Achievement::class);
    }
}
