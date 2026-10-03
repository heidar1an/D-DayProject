<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * SystemSetting — فاز ۲۰.
 *
 * مقدار کلید محرمانه رمزنگاری‌شده در `value` ذخیره می‌شود؛ `SystemSettingsService`
 * رمزنگاری/رمزگشایی را انجام می‌دهد و کلید محرمانه هرگز در پاسخ API ظاهر نمی‌شود
 * (§80). `version` مبنای optimistic lock است (§81).
 */
class SystemSetting extends Model
{
    use HasUuids;

    protected $table = 'system_settings';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_secret' => 'boolean',
            'version' => 'integer',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'updated_by_admin_id');
    }
}
