<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * خطای دامنه با کد و status صریح.
 *
 * چرا جدا از `abort()`/`HttpException`: نگاشت «status → code» در
 * `config/api.php` فقط برای خطاهای عمومی کافی است، ولی اینجا کد خطا بخشی از
 * قرارداد است (`INVALID_CREDENTIALS` با ۴۰۱ ≠ `UNAUTHENTICATED` با ۴۰۱).
 * `ApiExceptionHandler` این استثنا را اول از همه می‌شناسد.
 */
final class ApiErrorException extends RuntimeException
{
    /**
     * @param  array<string, list<string>>  $fields
     * @param  array<string, string>  $headers
     */
    public function __construct(
        public readonly string $errorCode,
        public readonly int $status,
        string $message,
        public readonly array $fields = [],
        public readonly array $headers = [],
    ) {
        parent::__construct($message);
    }

    /** @param array<string, list<string>> $fields */
    public static function invalid(array $fields, string $message = 'The given data was invalid.'): self
    {
        return new self('VALIDATION_FAILED', 422, $message, $fields);
    }

    /** خطای ورود — عمداً عمومی: هیچ تفکیکی بین «حساب نیست» و «رمز غلط» نیست. */
    public static function invalidCredentials(): self
    {
        return new self('INVALID_CREDENTIALS', 401, 'The provided credentials are incorrect.');
    }

    public static function unauthenticated(string $message = 'Unauthenticated.'): self
    {
        return new self('UNAUTHENTICATED', 401, $message);
    }

    public static function forbidden(string $message = 'Forbidden.'): self
    {
        return new self('FORBIDDEN', 403, $message);
    }

    /** ثبت‌نام با هویتی که از قبل وجود دارد (parity با legacy: ۴۰۹). */
    public static function alreadyExists(): self
    {
        return new self('USER_ALREADY_EXISTS', 409, 'An account with this identity already exists.');
    }

    public static function usernameTaken(): self
    {
        return new self('USERNAME_TAKEN', 409, 'This username is already taken.', ['username' => ['USERNAME_TAKEN']]);
    }

    public static function csrfFailed(string $message = 'CSRF token mismatch.'): self
    {
        return new self('CSRF_FAILED', 403, $message);
    }

    /** قابلیتی که provider واقعی ندارد — هرگز با ورود جعلی جبران نمی‌شود. */
    public static function notConfigured(string $feature): self
    {
        return new self('FEATURE_NOT_CONFIGURED', 503, "{$feature} is not configured.");
    }
}
