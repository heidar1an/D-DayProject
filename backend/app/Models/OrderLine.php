<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * سطر سفارش — فاز ۱۸.
 *
 * `unit_minor` قیمت واحد در **لحظهٔ خرید** است و با تغییر آیندهٔ طرح عوض
 * نمی‌شود. `snapshot` نام طرح/محصول و ورودی‌های محاسبه را نگه می‌دارد تا
 * بازسازی معامله بدون join به جدول‌های قابل‌تغییر ممکن باشد (§33).
 */
class OrderLine extends Model
{
    use HasUuids;

    protected $table = 'order_lines';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'unit_minor' => 'integer',
            'quantity' => 'integer',
            'line_total_minor' => 'integer',
            'snapshot' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }
}
