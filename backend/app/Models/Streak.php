<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * زنجیرهٔ روزهای فعال کاربر (فاز ۱۴).
 *
 * فقط از رخداد معتبر بک‌اند به‌روز می‌شود (`StreakService::touch` روی نشست
 * مطالعهٔ واقعی). باکت روز از ساعت **سرور** ساخته می‌شود؛ ورودی کلاینت هیچ
 * نقشی در محاسبه ندارد.
 */
class Streak extends Model
{
    use HasUuids;

    public const KIND_STUDY = 'study';

    protected $table = 'streaks';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'current_count' => 'integer',
            'longest_count' => 'integer',
            'last_day' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
