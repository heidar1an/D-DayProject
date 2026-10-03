<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * کلید idempotency — زیرساخت مشترک فاز ۵ و ۶.
 *
 * این رکورد transient است (`expires_at` اجباری) و پاسخِ ذخیره‌شده‌اش همان چیزی
 * است که کلاینت یک بار دیده؛ هیچ دادهٔ محرمانه‌ای اینجا نمی‌آید.
 */
class IdempotencyKey extends Model
{
    use HasUuids;

    public const STATE_RESERVED = 'reserved';

    public const STATE_COMPLETED = 'completed';

    protected $table = 'idempotency_keys';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'response_body' => 'array',
            'expires_at' => 'datetime',
        ];
    }
}
