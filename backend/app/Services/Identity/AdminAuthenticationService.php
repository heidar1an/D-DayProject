<?php

namespace App\Services\Identity;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\AuthSession;

/**
 * ورود ادمین پنل — آینهٔ `AuthenticationService` دانشجو، با همان سخت‌گیری‌ها:
 *   • خطای یکسان برای «ادمین نیست»، «رمز غلط»، «غیرفعال» و «بدون رمز».
 *   • verify ساختگی برای یکسان‌سازی زمان پاسخ (ضد timing enumeration).
 *   • ارتقای هش legacy پس از ورود موفق.
 *   • rotation سشن.
 *
 * تفاوت عمدی: ادمین مجوز نمی‌گیرد مگر از نقش‌هایش. ورود موفق با نقش صفر
 * انجام می‌شود ولی همهٔ مسیرهای پنل ۴۰۳ می‌دهند (deny-by-default).
 */
class AdminAuthenticationService
{
    public function __construct(
        private readonly PasswordHasher $hasher,
        private readonly SessionManager $sessions,
    ) {}

    /**
     * @return array{admin: Admin, issued: IssuedSession, rehashed: bool}
     */
    public function attempt(string $username, string $password, ?AuthSession $current = null): array
    {
        $normalized = mb_strtolower(trim($username));

        $admin = $normalized === ''
            ? null
            : Admin::query()->whereRaw('lower(username) = ?', [$normalized])->first();

        $stored = $admin?->password_hash;

        if ($stored === null || $stored === '' || $admin->isActive() !== true) {
            $this->hasher->verify($password, $this->dummyHash());

            throw ApiErrorException::invalidCredentials();
        }

        if (! $this->hasher->verify($password, $stored)) {
            throw ApiErrorException::invalidCredentials();
        }

        $rehashed = false;

        if (config('identity.passwords.rehash_legacy_on_login') === true && $this->hasher->needsRehash($stored)) {
            $admin->forceFill(['password_hash' => $this->hasher->hash($password)])->save();

            $rehashed = true;
        }

        $admin->forceFill(['last_login_at' => now()])->save();

        $issued = $this->sessions->rotateForAdmin($current, $admin);

        return ['admin' => $admin, 'issued' => $issued, 'rehashed' => $rehashed];
    }

    private function dummyHash(): string
    {
        static $hash = null;

        return $hash ??= $this->hasher->hash(bin2hex(random_bytes(16)));
    }
}
