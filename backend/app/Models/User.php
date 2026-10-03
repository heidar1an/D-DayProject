<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * هویت کاربر (principal: user).
 *
 * نکته‌های امنیتی که نباید تغییر کنند:
 *   • `password_hash` هرگز در `$fillable` نیست و در `$hidden` است.
 *   • `google_subject` شناسهٔ بیرونی است و لو نمی‌رود. در `$fillable` هم نیست:
 *     اتصال حساب گوگل باید از سرویس Google و با `forceFill` انجام شود، نه از
 *     ورودی کلاینت (وگرنه کسی می‌تواند حساب خود را به یک subject دلخواه بچسباند).
 *   • `getAuthPassword()` روی `password_hash` سوار است؛ ستون `password` وجود
 *     ندارد تا مسیرهای پیش‌فرض Laravel (که رمز خام را هش می‌کنند) اشتباه نروند.
 *   • Role/permission هیچ ستونی اینجا ندارد: در فاز ۲ وجود ندارد (BluePrint §19)
 *     و در فاز ۳ جدول‌های خودش را خواهد داشت — نه ستون روی users.
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasUuids, Notifiable;

    protected $table = 'users';

    /** @var list<string> */
    protected $fillable = [
        'phone',
        'email',
        'email_verified_at',
        'password_updated_at',
    ];

    /** @var list<string> */
    protected $hidden = [
        'password_hash',
        'google_subject',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password_updated_at' => 'datetime',
        ];
    }

    public function profile(): HasOne
    {
        return $this->hasOne(UserProfile::class);
    }

    /** @return HasMany<AuthSession, $this> */
    public function authSessions(): HasMany
    {
        return $this->hasMany(AuthSession::class);
    }

    /** رمز هش‌شده — تنها منبع حقیقت برای verify. */
    public function getAuthPassword(): string
    {
        return (string) $this->password_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    /** آیا این حساب اصلاً رمز دارد؟ (حساب‌های Google-only رمز ندارند.) */
    public function hasPassword(): bool
    {
        return $this->password_hash !== null && $this->password_hash !== '';
    }
}
