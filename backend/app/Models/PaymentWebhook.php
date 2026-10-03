<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * رخداد Webhook درگاه — فاز ۱۸. دفتر ضد تکرار (idempotency ledger).
 *
 * `UNIQUE(provider, event_id)` تنها تضمین واقعی «همان رخداد دو بار اثر نکند»
 * است. بررسی در کد race-safe نیست؛ درگاه می‌تواند دو درخواست هم‌زمان بفرستد.
 *
 * `payload_hash` = SHA-256 بدنهٔ خام. اگر همان `event_id` با بدنهٔ **متفاوت**
 * بیاید، یعنی یا درگاه قراردادش را عوض کرده یا کسی دارد دستکاری می‌کند ⇒ رد
 * می‌شود. `payload_hash` هش است، نه بدنه — پس هیچ دادهٔ حساسی اینجا نمی‌نشیند.
 *
 * وضعیت‌ها: `received` (تازه) · `processed` (اثر اعمال شد) · `ignored` (تکراری
 * یا بی‌اثر) · `rejected` (امضا/مبلغ/شناسه نامعتبر).
 */
class PaymentWebhook extends Model
{
    use HasUuids;

    public const STATUS_RECEIVED = 'received';

    public const STATUS_PROCESSED = 'processed';

    public const STATUS_IGNORED = 'ignored';

    public const STATUS_REJECTED = 'rejected';

    protected $table = 'payment_webhooks';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['processed_at' => 'datetime'];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'payment_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }
}
