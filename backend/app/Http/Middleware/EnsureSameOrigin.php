<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiErrorException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * بررسی same-origin برای همهٔ درخواست‌های نوشتاری.
 *
 * چرا لازم است حتی با وجود SameSite=Strict: SameSite یک محافظ مرورگری است، نه
 * یک قرارداد سرور؛ و روی مرورگرهای قدیمی/پروکسی‌ها رفتار یکسان ندارد. اینجا
 * سرور مستقل تصمیم می‌گیرد و Origin/Referer غایب هم **رد** می‌شود (fail-closed).
 *
 * فقط روی POST/PUT/PATCH/DELETE اعمال می‌شود؛ GET بی‌اثر است.
 */
class EnsureSameOrigin
{
    private const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->method(), self::WRITE_METHODS, true)) {
            return $next($request);
        }

        if (config('identity.origin.enforce') !== true) {
            return $next($request);
        }

        $origin = $this->origin($request);

        if ($origin === null) {
            throw ApiErrorException::forbidden('Origin header is required for write requests.');
        }

        $host = parse_url($origin, PHP_URL_HOST);

        if (! is_string($host) || $host === '' || strcasecmp($host, $request->getHost()) !== 0) {
            throw ApiErrorException::forbidden('Cross-origin request rejected.');
        }

        return $next($request);
    }

    private function origin(Request $request): ?string
    {
        $origin = $request->headers->get('Origin');

        if (is_string($origin) && $origin !== '' && $origin !== 'null') {
            return $origin;
        }

        // برخی کلاینت‌ها فقط Referer می‌فرستند؛ اگر Origin نبود، از آن استفاده می‌شود.
        $referer = $request->headers->get('Referer');

        if (! is_string($referer) || $referer === '') {
            return null;
        }

        $scheme = parse_url($referer, PHP_URL_SCHEME);
        $host = parse_url($referer, PHP_URL_HOST);
        $port = parse_url($referer, PHP_URL_PORT);

        if (! is_string($scheme) || ! is_string($host)) {
            return null;
        }

        return $scheme.'://'.$host.($port !== null ? ':'.$port : '');
    }
}
