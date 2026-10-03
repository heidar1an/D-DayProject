<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * محصول تجاری — فاز ۱۸.
 *
 * «محصول» = چیزی که فروخته می‌شود (اشتراک عادی/پرو/گروهی). «طرح» (Plan) قیمت
 * همان محصول در یک چرخهٔ مشخص است. «قابلیت» چیزی است که محصول اعطا می‌کند.
 *
 * حذف فیزیکی محصولی که تاریخچهٔ مالی دارد ممنوع است؛ `status = archived` تنها
 * راه بازنشستگی است (Prompt §23/§56).
 */
class Product extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

    public const KIND_SUBSCRIPTION = 'subscription';

    protected $table = 'products';

    /** @var list<string> */
    protected $fillable = [];

    /** @return HasMany<ProductCapability, $this> */
    public function capabilities(): HasMany
    {
        return $this->hasMany(ProductCapability::class, 'product_id');
    }

    /** @return HasMany<Plan, $this> */
    public function plans(): HasMany
    {
        return $this->hasMany(Plan::class, 'product_id')->orderBy('cycle_months');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /** @param Builder<Product> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('status', self::STATUS_ACTIVE);
    }
}
