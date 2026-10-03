<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * اشتراک — فاز ۱۸. مالک «دسترسی دوره‌ای» است.
 *
 * `status = active` **هرگز** از ورودی کلاینت ست نمی‌شود؛ فقط
 * `SubscriptionService` پس از تأیید پرداخت آن را می‌نویسد (Prompt §46).
 *
 * «منقضی» دو معنا دارد و هر دو باید بسته شوند:
 *   ۱. `status = expired` (وضعیت صریح، نوشتهٔ سرویس/Job)
 *   ۲. `ends_at` گذشته ولی وضعیت هنوز `active`
 * برای همین `EntitlementService` هم وضعیت را می‌بیند و هم `ends_at` را —
 * نه یکی از آن‌ها (§75: بدون نیاز به refresh سمت کلاینت).
 */
class Subscription extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_REVOKED = 'revoked';

    protected $table = 'subscriptions';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /** @return HasMany<Entitlement, $this> */
    public function entitlements(): HasMany
    {
        return $this->hasMany(Entitlement::class, 'source_subscription_id');
    }

    /** فعال است **و** پنجرهٔ زمانی‌اش نگذشته. */
    public function isEffective(): bool
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return false;
        }

        return $this->ends_at === null || $this->ends_at->isFuture();
    }

    /** @param Builder<Subscription, $this> $query */
    public function scopeEffective(Builder $query): void
    {
        $query->where('status', self::STATUS_ACTIVE)
            ->where(fn ($inner) => $inner->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }
}
