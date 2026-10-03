<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * طرح قیمت — فاز ۱۸.
 *
 * یک Plan = (محصول × چرخهٔ پرداخت). `price_minor` **قیمت ماهانهٔ یک نفر** است،
 * نه مبلغ نهایی: مبلغ نهایی سمت سرور در `PricingService::quote()` محاسبه
 * می‌شود تا کلاینت هرگز نتواند مبلغ را تعیین کند.
 *
 * گیت تأیید قیمت (Prompt §26/§68): طرح تا وقتی `approved_at` نداشته باشد
 * **قابل خرید نیست** — حتی اگر `status = active` باشد و در فهرست دیده شود.
 * دلیل: مبالغ فعلی محصول «نمونه» هستند و UI خودش این را می‌گوید
 * (`PRICING_META.amountsConfirmed === false`). پس نمایش با «تأییدنشده» و
 * خرید با «ممنوع» دو رفتار جدا دارند و هیچ‌کدام جعل نمی‌شود.
 */
class Plan extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'plans';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'price_minor' => 'integer',
            'cycle_months' => 'integer',
            'discount_percent' => 'integer',
            'pricing_rules' => 'array',
            'approved_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function isApproved(): bool
    {
        return $this->approved_at !== null;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * آیا این طرح قابل خرید است؟ (فعال + تأییدشده + قیمت معتبر + محصول فعال)
     *
     * تنها تعریف «قابل خرید بودن» — جای دیگری تکرار نشود. `QuoteService` و
     * `OrderService` و `PricingService` همه از همین عبور می‌کنند.
     */
    public function isPurchasable(): bool
    {
        return $this->isActive()
            && $this->isApproved()
            && $this->price_minor > 0
            && $this->product instanceof Product
            && $this->product->isActive();
    }

    /** @param Builder<Plan> $query */
    public function scopeVisibleInCatalog(Builder $query): void
    {
        $query->where('status', self::STATUS_ACTIVE)
            ->whereHas('product', fn ($inner) => $inner->where('status', Product::STATUS_ACTIVE));
    }
}
