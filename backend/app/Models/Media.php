<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Media Core — فاز ۱۵.
 *
 * مالکیت: Media فقط Storage/Metadata concerns را می‌داند و هیچ رابطه‌ای به
 * Reference/Anatomy/Article ندارد (§55). `key` مسیر منطقی روی دیسک است و از
 * ورودی کاربر ساخته نمی‌شود. `$fillable` خالی: همهٔ ستون‌ها با forceFill از
 * سرویس پر می‌شوند تا Mass Assignment در ریشه بسته بماند.
 */
class Media extends Model
{
    use HasUuids;

    public const VISIBILITY_PUBLIC = 'public';

    public const VISIBILITY_PRIVATE = 'private';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'media';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'size_bytes' => 'integer',
        ];
    }

    public function ownerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function ownerAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'owner_admin_id');
    }

    public function isPublic(): bool
    {
        return $this->visibility === self::VISIBILITY_PUBLIC;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
