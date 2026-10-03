<?php

namespace App\Services\Identity;

use App\Exceptions\ApiErrorException;
use App\Models\AuthSession;
use App\Models\User;

/**
 * ورود.
 *
 * تصمیم‌های کلیدی:
 *   • خطای ورود همیشه یکسان است (`INVALID_CREDENTIALS`): «شماره وجود ندارد» و
 *     «رمز اشتباه است» از هم تفکیک نمی‌شوند ⇒ هیچ enumeration‌ای ممکن نیست.
 *   • برای حساب ناموجود هم یک verify ساختگی اجرا می‌شود تا زمان پاسخ حساب
 *     ناموجود و حساب موجود با رمز غلط قابل‌تفکیک نباشد (timing enumeration).
 *   • حساب بدون رمز (Google-only) هم با همین خطای عمومی رد می‌شود؛ هرگز با
 *     رمز خالی وارد نمی‌شود.
 *   • پس از ورود موفق، هش legacy (scrypt/SHA-256) به Argon2id ارتقا می‌یابد —
 *     شفاف، تدریجی و بدون دخالت کاربر (BluePrint §12).
 *   • rotation: سشنِ ارائه‌شده باطل و سشن تازه صادر می‌شود (ضد fixation).
 */
class AuthenticationService
{
    public function __construct(
        private readonly IdentityNormalizer $normalizer,
        private readonly PasswordHasher $hasher,
        private readonly SessionManager $sessions,
    ) {}

    /**
     * @return array{user: User, issued: IssuedSession, rehashed: bool}
     */
    public function attempt(string $identity, string $password, ?AuthSession $current = null): array
    {
        $resolved = $this->normalizer->identity($identity);

        $user = match ($resolved['type']) {
            'phone' => User::query()->where('phone', $resolved['value'])->first(),
            'email' => User::query()->where('email', $resolved['value'])->first(),
            default => null,
        };

        $stored = $user?->password_hash;

        if ($stored === null || $stored === '') {
            // verify ساختگی: هزینهٔ محاسباتی مشابه، بدون هیچ اطلاعاتی دربارهٔ وجود حساب.
            $this->hasher->verify($password, $this->dummyHash());

            throw ApiErrorException::invalidCredentials();
        }

        if (! $this->hasher->verify($password, $stored)) {
            throw ApiErrorException::invalidCredentials();
        }

        $rehashed = false;

        if (config('identity.passwords.rehash_legacy_on_login') === true && $this->hasher->needsRehash($stored)) {
            $user->forceFill([
                'password_hash' => $this->hasher->hash($password),
                'password_updated_at' => now(),
            ])->save();

            $rehashed = true;
        }

        $issued = $this->sessions->rotate($current, $user);

        return ['user' => $user, 'issued' => $issued, 'rehashed' => $rehashed];
    }

    /**
     * هش ساختگی برای یکسان‌سازی زمان پاسخ. یک‌بار در هر process ساخته و
     * کش می‌شود؛ هیچ رمز واقعی در آن نیست.
     */
    private function dummyHash(): string
    {
        static $hash = null;

        return $hash ??= $this->hasher->hash(bin2hex(random_bytes(16)));
    }
}
