<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * قابلیت یک محصول — فاز ۱۸.
 *
 * **این جدول، فهرست بستهٔ «قابلیت‌های قابل‌دروازه‌بانی» است.** یعنی هر code که
 * اینجا نباشد، در `EntitlementGate` دروازه‌بانی نمی‌شود. چرا مهم است: قابلیت‌های
 * عمومی مثل `content.lesson_page` (که `ProgressService` می‌پرسد) نباید با فعال
 * شدن enforcement قفل شوند؛ چون هیچ محصولی آن‌ها را نمی‌فروشد، عملاً «بدون
 * دروازه» می‌مانند. این طراحی، فعال‌کردن entitlement را بی‌خطر می‌کند.
 *
 * codeها از مدل واقعی محصول استخراج شده‌اند (`services/pricing/pricingService.js`:
 * `CAPABILITY_ROWS`) و هیچ واژگان تازه‌ای اختراع نشد. `coverage` هم واقعی است:
 * ماتریس مقایسهٔ UI سه سطح full/partial دارد.
 *
 * ⚠️ Capability ≠ Role. اینجا هیچ نقش/مجوز ادمینی ساخته نمی‌شود.
 */
class ProductCapability extends Model
{
    use HasUuids;

    public const COVERAGE_FULL = 'full';

    public const COVERAGE_PARTIAL = 'partial';

    protected $table = 'product_capabilities';

    /** @var list<string> */
    protected $fillable = [];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
