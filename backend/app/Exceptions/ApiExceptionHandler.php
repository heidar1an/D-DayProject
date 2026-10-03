<?php

namespace App\Exceptions;

use App\Http\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Renders every API failure as the standard v1 error envelope. 5xx responses
 * never leak stack traces, exception class names or internals — details stay
 * in the structured log under the same requestId. Non-API surfaces (e.g. /up)
 * keep the framework rendering.
 */
class ApiExceptionHandler
{
    private const FALLBACK_MESSAGES = [
        400 => 'The request could not be understood.',
        401 => 'Unauthenticated.',
        403 => 'Forbidden.',
        404 => 'Not found.',
        405 => 'Method not allowed.',
        409 => 'Conflict.',
        413 => 'Payload too large.',
        415 => 'Unsupported media type.',
        422 => 'The given data was invalid.',
        429 => 'Too many requests.',
        500 => 'Internal server error.',
        503 => 'Service unavailable.',
    ];

    public static function render(Throwable $e, Request $request): ?Response
    {
        if (! ($request->is('api/*') || $request->expectsJson())) {
            return null;
        }

        /*
         * پاسخ سفارشیِ میان‌افزارها (مثل ۴۲۹ کاستومِ rate limit) با
         * `HttpResponseException` حمل می‌شود. این کلاس نه `HttpExceptionInterface`
         * است و نه خطای دامنه؛ اگر عبور نکند، envelope عمومی آن را ۵۰۰ می‌کند و
         * پاسخ ۴۲۹ی که خودمان ساختیم دور ریخته می‌شود.
         */
        if ($e instanceof HttpResponseException) {
            return $e->getResponse();
        }

        // خطای دامنه: کد و status خودش را دارد (مثلاً INVALID_CREDENTIALS با ۴۰۱).
        if ($e instanceof ApiErrorException) {
            return ApiResponse::error(
                $e->errorCode,
                $e->getMessage(),
                $e->status,
                $e->fields,
                $e->headers,
            );
        }

        [$status, $headers] = self::statusAndHeaders($e);
        $fields = [];

        if ($e instanceof ValidationException) {
            $status = $e->status;
            $headers = [];
            $fields = $e->errors();
        }

        return ApiResponse::error(
            self::code($status),
            self::message($e, $status),
            $status,
            $fields,
            $headers,
        );
    }

    /** @return array{0: int, 1: array<string, string>} */
    private static function statusAndHeaders(Throwable $e): array
    {
        if ($e instanceof AuthenticationException) {
            return [401, []];
        }

        if ($e instanceof AuthorizationException || $e instanceof AccessDeniedHttpException) {
            return [403, []];
        }

        if ($e instanceof ModelNotFoundException) {
            return [404, []];
        }

        if ($e instanceof PostTooLargeException) {
            return [413, []];
        }

        if ($e instanceof HttpExceptionInterface) {
            return [$e->getStatusCode(), $e->getHeaders()];
        }

        return [500, []];
    }

    private static function message(Throwable $e, int $status): string
    {
        // سرریز ۵xx هرگز جزئیات داخلی (کلاس، پیام، trace) را به کلاینت نمی‌دهد.
        if ($status >= 500) {
            return self::FALLBACK_MESSAGES[$status] ?? 'Internal server error.';
        }

        if ($e instanceof ValidationException) {
            return 'The given data was invalid.';
        }

        // نام مدل در ModelNotFoundException آشکار می‌شود؛ عمومی نگه داشته می‌شود.
        if ($e instanceof ModelNotFoundException) {
            return self::FALLBACK_MESSAGES[404];
        }

        $message = $e->getMessage();

        return ($message !== '') ? $message : (self::FALLBACK_MESSAGES[$status] ?? 'Request failed.');
    }

    private static function code(int $status): string
    {
        return Config::get('api.error_codes.'.$status, 'HTTP_'.$status);
    }
}
