<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * گروه مطالعه — فاز ۱۶.
 *
 * `code_hash` فقط SHA-256 نرمال‌شدهٔ کد است؛ Plaintext فقط یک‌بار در پاسخ
 * create/rotate برمی‌گردد و هرگز ذخیره/لاگ نمی‌شود (§39/§44). `plan_id`
 * رشتهٔ اطلاع‌رسانی است — هیچ رابطهٔ Commerce در این فاز نیست (§58).
 */
class StudyGroup extends Model
{
    use HasUuids;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'study_groups';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'seats' => 'integer',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    /** @return HasMany<GroupMembership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(GroupMembership::class, 'group_id');
    }

    public function isArchived(): bool
    {
        return $this->status === self::STATUS_ARCHIVED;
    }
}
