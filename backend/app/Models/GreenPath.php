<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * مسیر سبز — برنامهٔ مطالعهٔ کاربر (فاز ۱۳).
 *
 * مالک Roadmap است، نه پیشرفت واقعی. «کاربر چه کرد» فقط در
 * `learning_progress`/`exam_results` زندگی می‌کند و این جدول آن را مصرف می‌کند.
 *
 *   • یک مسیر فعال per-user (unique partial index در دیتابیس).
 *   • مسیر هرگز حذف فیزیکی نمی‌شود؛ Rebuild یعنی `status = archived`.
 *   • `plan_version` با هر rebuild بالا می‌رود — تاریخچهٔ نسخهٔ برنامه.
 */
class GreenPath extends Model
{
    use HasUuids;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'green_paths';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'plan_version' => 'integer',
            'starts_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function semester(): BelongsTo
    {
        return $this->belongsTo(Semester::class);
    }

    /** @return HasMany<GreenPathStep, $this> */
    public function steps(): HasMany
    {
        return $this->hasMany(GreenPathStep::class, 'path_id')->orderBy('position');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
