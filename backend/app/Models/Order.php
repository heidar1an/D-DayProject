<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * سفارش — فاز ۱۸. مالک «قصد خرید و تاریخچهٔ معامله» است.
 *
 * `total_minor` **فقط سمت سرور** از `quote_snapshot` ساخته می‌شود. هیچ مسیری
 * مبلغ را از بدنهٔ درخواست نمی‌پذیرد (Prompt §22).
 *
 * `quote_snapshot` عکس لحظهٔ محاسبه است: محصول، طرح، قیمت واحد، تخفیف، تعداد و
 * کل. بدون آن، تغییر قیمت فردا، سند دیروز را بی‌معنا می‌کرد. Snapshot **هیچ**
 * رمز/توکن/Secret ندارد — فقط دادهٔ لازم برای بازسازی معامله.
 *
 * تغییر وضعیت فقط از `OrderService` و با نقشهٔ گذار صریح انجام می‌شود؛
 * `failed → paid` هرگز مجاز نیست (§35).
 */
class Order extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_AWAITING_PAYMENT = 'awaiting_payment';

    public const STATUS_PAID = 'paid';

    public const STATUS_FAILED = 'failed';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_CANCELLED = 'cancelled';

    /** وضعیت‌های پایانی — هیچ گذاری از آن‌ها بیرون نمی‌رود. */
    public const TERMINAL = [self::STATUS_PAID, self::STATUS_EXPIRED, self::STATUS_CANCELLED];

    protected $table = 'orders';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'total_minor' => 'integer',
            'quote_snapshot' => 'array',
            'expires_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<OrderLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(OrderLine::class, 'order_id');
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'order_id');
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    /** آیا پنجرهٔ پرداخت تمام شده؟ مقایسه با **ساعت سرور**، نه کلاینت. */
    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isPayable(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_AWAITING_PAYMENT], true)
            && ! $this->isExpired();
    }

    /** @param Builder<Order> $query */
    public function scopeOwnedBy(Builder $query, string $userId): void
    {
        $query->where('user_id', $userId);
    }
}
