<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * وضعیت چالش برای یک کاربر در یک دورهٔ زمانی (فاز ۱۴).
 *
 * `period_key` برای چالش روزانه شکل `2026-10-03` و برای هفتگی `2026-W40` دارد —
 * هر دو از ساعت سرور. UNIQUE(user_id, challenge_id, period_key) یعنی هر دوره
 * فقط یک رکورد؛ progress تکراری در همان دوره جمع می‌شود، رکورد تکراری نمی‌سازد.
 */
class UserChallenge extends Model
{
    use HasUuids;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_EXPIRED = 'expired';

    protected $table = 'user_challenges';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'progress' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function challenge(): BelongsTo
    {
        return $this->belongsTo(Challenge::class);
    }
}
