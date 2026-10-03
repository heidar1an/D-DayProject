<?php

namespace App\Services\Identity;

/**
 * سیاست رمز عبور — آینهٔ `database/authPolicy.js` در Node.
 *
 * چرا آینه: کاربری که رمزش را در سیستم قدیمی ساخته باید همان قواعد را در v1
 * ببیند؛ دو سیاست متفاوت یعنی «رمز معتبر دیروز، نامعتبر امروز».
 *
 * خروجی `{code, message}` است (parity با legacy) تا فرانت‌اند بتواند روی `code`
 * تصمیم بگیرد. کلاس خالص است: بدون I/O.
 */
class PasswordPolicy
{
    /**
     * رمزهای پرتکرار — عیناً همان فهرست `authPolicy.js` (کوچک و عامدانه:
     * هدف بدیهی‌ترین‌هاست، نه یک دیکشنری کامل).
     *
     * @var list<string>
     */
    private const WEAK = [
        'password', 'passw0rd', 'password1', '12345678', '123456789', '1234567890',
        'qwertyui', 'qwerty123', '11111111', '00000000', 'abcd1234', 'iloveyou',
        'tapesh123', 'admin123', 'letmein1', 'welcome1', 'football', 'monkey123',
    ];

    /** @return array{code: string, message: string}|null  `null` یعنی پذیرفته شد. */
    public function check(string $password): ?array
    {
        $min = (int) config('identity.passwords.min_length');
        $max = (int) config('identity.passwords.max_length');

        if ($password === '') {
            return $this->reject('PASSWORD_REQUIRED', 'Password is required.');
        }

        if (trim($password) === '') {
            return $this->reject('PASSWORD_REQUIRED', 'Password cannot be only whitespace.');
        }

        // نویسهٔ کنترلی/خط جدید ⇒ ورودی malformed، نه رمز ضعیف.
        if (preg_match('/[\x00-\x1f\x7f]/', $password) === 1) {
            return $this->reject('PASSWORD_MALFORMED', 'Password contains invalid characters.');
        }

        if (mb_strlen($password) > $max) {
            return $this->reject('PASSWORD_TOO_LONG', "Password must not exceed {$max} characters.");
        }

        // طول با NFKC سنجیده می‌شود تا «۱۲۳۴» یا نیم‌فاصله طول واقعی را کم نشان ندهد.
        $normalized = $this->normalize($password);

        if (mb_strlen(trim($normalized)) < $min) {
            return $this->reject('PASSWORD_TOO_SHORT', "Password must be at least {$min} characters.");
        }

        $compact = preg_replace('/\s+/u', '', $normalized) ?? '';

        /*
         * ارقام فارسی/عربی برای **سنجش ضعف** معادل لاتین در نظر گرفته می‌شوند:
         * «۱۲۳۴۵۶۷۸» همان «12345678» است و نباید از فهرست رمزهای پرتکرار
         * بگریزد. توجه: این تبدیل فقط روی مقایسه اثر دارد؛ مقداری که هش می‌شود
         * دست‌نخورده است، پس هیچ رمزی بی‌صدا عوض نمی‌شود.
         */
        $folded = (new IdentityNormalizer)->digits($compact);

        if (preg_match('/^\d+$/', $folded) === 1) {
            return $this->reject('PASSWORD_TOO_WEAK', 'Password must not be only digits.');
        }

        if (mb_strlen($folded) > 1 && count(array_unique(preg_split('//u', $folded, -1, PREG_SPLIT_NO_EMPTY))) === 1) {
            return $this->reject('PASSWORD_TOO_WEAK', 'Password must not repeat a single character.');
        }

        if (in_array(mb_strtolower($folded), self::WEAK, true)) {
            return $this->reject('PASSWORD_TOO_WEAK', 'This password is too common; choose another one.');
        }

        return null;
    }

    public function isValid(string $password): bool
    {
        return $this->check($password) === null;
    }

    /** @return array{code: string, message: string} */
    private function reject(string $code, string $message): array
    {
        return ['code' => $code, 'message' => $message];
    }

    private function normalize(string $value): string
    {
        if (class_exists(\Normalizer::class)) {
            $normalized = \Normalizer::normalize($value, \Normalizer::FORM_KC);

            if (is_string($normalized)) {
                return $normalized;
            }
        }

        return $value;
    }
}
