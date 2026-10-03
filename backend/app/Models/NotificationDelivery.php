<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * NotificationDelivery — فاز ۱۹.
 *
 * وضعیت تحویل به‌ازای هر کانال. `UNIQUE(notification_id, channel)` در دیتابیس
 * تضمین می‌کند تحویل تکراری ساخته نشود (§20).
 */
class NotificationDelivery extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_SENT = 'sent';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUS_FAILED = 'failed';

    public const STATUS_SKIPPED = 'skipped';

    protected $table = 'notification_deliveries';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
        ];
    }

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class, 'notification_id');
    }
}
