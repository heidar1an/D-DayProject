<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Notification — فاز ۱۹.
 *
 * Delivery Projection است، نه منبع حقیقت دامنه (§21). `read_at` فقط
 * سرور-محور است و مالکیت فقط از سشن می‌آید (§26).
 *
 * `$fillable` خالی: هیچ فیلدی از بدنهٔ درخواست نوشته نمی‌شود.
 */
class Notification extends Model
{
    use HasUuids;

    public const TYPE_ACHIEVEMENT_UNLOCKED = 'achievement_unlocked';

    public const TYPE_EXAM_RESULT = 'exam_result';

    public const TYPE_FEEDBACK_REPLY = 'feedback_reply';

    public const TYPE_SYSTEM = 'system';

    protected $table = 'notifications';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return HasMany<NotificationDelivery, $this> */
    public function deliveries(): HasMany
    {
        return $this->hasMany(NotificationDelivery::class, 'notification_id');
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    /** @param Builder<Notification> $query */
    public function scopeUnread(Builder $query): void
    {
        $query->whereNull('read_at');
    }

    /** @param Builder<Notification> $query */
    public function scopeForUser(Builder $query, string $userId): void
    {
        $query->where('user_id', $userId);
    }
}
