<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiErrorException;
use App\Services\Identity\SessionManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * توکن CSRF به‌شکل double-submit.
 *
 * قرارداد: هشِ توکن در `auth_sessions.csrf_hash` و مقدار خام در کوکیِ
 * **غیر-HttpOnly** `tapesh_csrf` است؛ SPA آن را می‌خواند و در هدر
 * `X-CSRF-Token` می‌فرستد. بدون کوکی سشن، توکن هیچ کاری نمی‌کند.
 *
 * برای درخواست‌های بدون سشن (register/login) توکنی وجود ندارد و این میان‌افزار
 * کاری نمی‌کند؛ آن مسیرها با same-origin + rate limit محافظت می‌شوند.
 */
class EnsureCsrfToken
{
    private const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    public function __construct(private readonly SessionManager $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->method(), self::WRITE_METHODS, true)) {
            return $next($request);
        }

        $session = $request->attributes->get(ResolveApiSession::ATTRIBUTE);

        if ($session === null) {
            return $next($request);
        }

        $presented = $request->headers->get((string) config('identity.csrf.header'));

        if (! is_string($presented) || $presented === '') {
            $fallback = $request->input('_csrf');
            $presented = is_string($fallback) ? $fallback : null;
        }

        if (! $this->sessions->csrfMatches($session, $presented)) {
            throw ApiErrorException::csrfFailed();
        }

        return $next($request);
    }
}
