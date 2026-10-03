<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * سشن سرور-کنترل‌شده.
 *
 * `token_hash` و `csrf_hash` در `$hidden` هستند و در `$fillable` نیستند: تنها
 * نویسندهٔ آن‌ها `SessionManager` است، و هیچ مسیری از Request به این ستون‌ها
 * نمی‌رسد. مقدار خام توکن هرگز روی این مدل قرار نمی‌گیرد.
 */
class AuthSession extends Model
{
    use HasUuids;

    public const PRINCIPAL_USER = 'user';

    public const PRINCIPAL_ADMIN = 'admin';

    protected $table = 'auth_sessions';

    /** @var list<string> */
    protected $fillable = [
        'principal_type',
        'expires_at',
        'last_seen_at',
        'revoked_at',
    ];

    /** @var list<string> */
    protected $hidden = ['token_hash', 'csrf_hash'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * اصل ادمین (فاز ۳). `admin_id` عمداً FK ندارد چون ستونش در فاز ۲ و پیش از
     * وجود جدول `admins` ساخته شد و `ALTER TABLE ... ADD CONSTRAINT` در SQLite
     * پشتیبانی نمی‌شود. `SessionManager::resolve` وجود این اصل را چک می‌کند.
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class);
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /** تنها تعریف «سشن قابل‌استفاده» در کل کد — جای دیگری تکرار نشود. */
    public function isActive(): bool
    {
        return ! $this->isRevoked() && ! $this->isExpired();
    }

    /** @param Builder<AuthSession> $query */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('revoked_at')->where('expires_at', '>', now());
    }
}
