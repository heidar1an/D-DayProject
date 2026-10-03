<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * عضویت گروه — فاز ۱۶. حذف ردیف = خروج/حذف عضو (pivot، CASCADE مجاز).
 */
class GroupMembership extends Model
{
    use HasUuids;

    public const ROLE_OWNER = 'owner';

    public const ROLE_MEMBER = 'member';

    protected $table = 'group_memberships';

    /** @var list<string> */
    protected $fillable = [];

    public function group(): BelongsTo
    {
        return $this->belongsTo(StudyGroup::class, 'group_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
