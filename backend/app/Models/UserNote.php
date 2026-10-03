<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * یادداشت شخصی کاربر — فاز ۱۶. از `admin_notes` کاملاً جداست (§31).
 *
 * `content` فقط دادهٔ kind خودش را نگه می‌دهد (items/pairs/table) و در سرویس
 * validate می‌شود. `source` سه‌تایی: نوع (allowlist) + شناسه اختیاری + عنوان
 * نمایشی که UI واقعی امروز می‌فرستد.
 */
class UserNote extends Model
{
    use HasUuids;

    public const KIND_TEXT = 'text';

    public const KIND_CHECKLIST = 'checklist';

    public const KIND_QA = 'qa';

    public const KIND_TABLE = 'table';

    protected $table = 'user_notes';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'content' => 'array',
            'tags' => 'array',
            'pinned' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
