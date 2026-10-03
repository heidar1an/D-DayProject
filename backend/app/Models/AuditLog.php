<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * AuditLog — فاز ۲۰.
 *
 * **Append-only**: مدل ویرایش و حذف را قفل می‌کند (§82). هیچ مسیری نباید
 * audit را بازنویسی کند؛ اگر لازم شد، رکورد تازه ثبت می‌شود.
 *
 * `created_at` دارد ولی `updated_at` ندارد — به همین دلیل `UPDATED_AT = null`.
 */
class AuditLog extends Model
{
    use HasUuids;

    public const ACTOR_ADMIN = 'admin';

    public const ACTOR_USER = 'user';

    public const ACTOR_SYSTEM = 'system';

    public const UPDATED_AT = null;

    protected $table = 'audit_logs';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new LogicException('audit_logs is append-only: records cannot be updated.');
        });

        static::deleting(function (): never {
            throw new LogicException('audit_logs is append-only: records cannot be deleted.');
        });
    }
}
