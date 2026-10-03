<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * پرداخت — فاز ۱۸. مالک «وضعیت تراکنش درگاه» است.
 *
 * `authority` شناسهٔ یکتای درگاه برای این تراکنش است و `UNIQUE` دارد: همان
 * authority نمی‌تواند دو پرداخت بسازد. `provider_reference` شمارهٔ مرجع درگاه
 * پس از تأیید است و آن هم یکتاست. این دو، همراه با
 * `payment_webhooks UNIQUE(provider,event_id)`، ستون فقرات محافظت ضد تکرارند.
 *
 * قید دیتابیس: `(status='verified') ⟷ verified_at`. پس «تأییدشده بدون زمان»
 * یا «زمان تأیید بدون تأیید» در دیتابیس غیرقابل‌درج است.
 *
 * تغییرن‌پذیری: هیچ‌جا حذف نمی‌شود و مبلغ هیچ‌وقت ویرایش نمی‌شود؛ اصلاح فقط با
 * flow جبرانی (که در این فاز ساخته نشد چون UI ندارد).
 */
class Payment extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_FAILED = 'failed';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_CANCELLED = 'cancelled';

    protected $table = 'payments';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'amount_minor' => 'integer',
            'verified_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isVerified(): bool
    {
        return $this->status === self::STATUS_VERIFIED;
    }

    /** آیا تراکنش هنوز باز است؟ (تأیید دوباره فقط روی تراکنش باز معنا دارد) */
    public function isOpen(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }
}
