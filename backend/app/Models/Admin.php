<?php

namespace App\Models;

use Database\Factories\AdminFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

/**
 * هویت مدیر پنل (principal: admin) — فاز ۳.
 *
 * چرا این مدل در فاز ۵/۶ ساخته شد: CRUD سؤال بدون هویت ادمین و مجوز، قابل ساخت
 * امن نیست (فاز ۶ به فاز ۳ وابسته است). این مدل حداقلِ لازم است؛ مدیریت
 * ادمین‌ها و پنل کاربران جزء این فاز نیست.
 *
 * نکته‌های امنیتی:
 *   • `password_hash` در `$fillable` نیست و در `$hidden` است.
 *   • `active` در `$fillable` است ولی تغییرش از ورودی درخواست مسیر ندارد؛
 *     هیچ endpoint ای در این فاز ادمین را ویرایش نمی‌کند.
 *   • نقش روی `users` ستون ندارد و اینجا هم ندارد: `admin_roles` تنها منبع است.
 */
class Admin extends Authenticatable
{
    /** @use HasFactory<AdminFactory> */
    use HasFactory, HasUuids;

    protected $table = 'admins';

    /** @var list<string> */
    protected $fillable = [
        'username',
        'display_name',
        'active',
        'must_change_password',
    ];

    /** @var list<string> */
    protected $hidden = [
        'password_hash',
    ];

    /**
     * کش مجوزهای حل‌شده روی همان نمونهٔ مدل.
     *
     * چرا روی مدل و نه در سرویس: سرویس‌ها در تست‌ها بین درخواست‌ها بازاستفاده
     * می‌شوند و یک کش درون‌سرویسی می‌توانست مجوزهای ادمین قبلی را به ادمین
     * بعدی بچسباند. نمونهٔ مدل عمر کوتاه و per-request دارد.
     *
     * @var list<string>|null
     */
    public ?array $resolvedPermissions = null;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'must_change_password' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    /** @return BelongsToMany<Role, $this> */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'admin_roles')->withTimestamps();
    }

    public function getAuthPassword(): string
    {
        return (string) $this->password_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    public function isActive(): bool
    {
        return $this->active === true;
    }
}
