<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * تعریف یک نشان — دادهٔ مرجع (فاز ۱۴).
 *
 * بازکردن نشان فقط از `AchievementService` روی دادهٔ واقعی بک‌اند انجام
 * می‌شود؛ هیچ endpoint کلاینتی برای unlock وجود ندارد.
 */
class Achievement extends Model
{
    use HasUuids;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $table = 'achievements';

    /** @var list<string> */
    protected $fillable = [];
}
