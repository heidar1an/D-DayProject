<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Entitlement — فاز ۱۸. مالک «قابلیت واقعیِ اعطاشده به یک کاربر».
 *
 * ⚠️ Entitlement ≠ Role. نقش‌ها (`student`/`admin`/`editor`) در دامنهٔ هویت
 * زندگی می‌کنند؛ این جدول می‌گوید «کاربر X قابلیت Y را تا تاریخ Z دارد»
 * (Prompt §28). «کاربر پرمیوم» یک نقش تازه نیست.
 *
 * اعتبار = `starts_at <= now` **و** (`ends_at` null یا در آینده) **و**
 * `revoked_at` null. سه شرط، چون هر کدام می‌توانند مستقل از دیگری رخ دهند.
 *
 * ایجاد/لغو فقط از `EntitlementService` مجاز است. هیچ endpoint یا SQL ادمینی
 * مستقیم این جدول را نمی‌نویسد (§60).
 */
class Entitlement extends Model
{
    use HasUuids;

    protected $table = 'entitlements';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sourceOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'source_order_id');
    }

    public function sourceSubscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class, 'source_subscription_id');
    }

    public function isActive(): bool
    {
        if ($this->revoked_at !== null) {
            return false;
        }

        if ($this->starts_at !== null && $this->starts_at->isFuture()) {
            return false;
        }

        return $this->ends_at === null || $this->ends_at->isFuture();
    }

    /** @param Builder<Entitlement> $query */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('revoked_at')
            ->where(fn ($inner) => $inner->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($inner) => $inner->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }
}
