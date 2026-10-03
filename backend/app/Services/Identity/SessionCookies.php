<?php

namespace App\Services\Identity;

use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

/**
 * تنها جایی که کوکی‌های هویت ساخته/پاک می‌شوند.
 *
 * دو کوکی با دو نقش متفاوت:
 *   • سشن  → HttpOnly (JavaScript هرگز آن را نمی‌بیند) + SameSite + Secure شرطی
 *   • CSRF → خواندنی برای JS (HttpOnly ندارد) تا SPA بتواند آن را در هدر
 *            `X-CSRF-Token` بفرستد. خودِ توکن CSRF راز نیست؛ هش آن در دیتابیس
 *            است و بدون کوکی سشن هیچ کاری نمی‌کند (double-submit).
 */
class SessionCookies
{
    public function attach(Response $response, IssuedSession $issued): Response
    {
        $session = config('identity.cookies.session');
        $csrf = config('identity.cookies.csrf');

        $response->headers->setCookie($this->make(
            name: $session,
            value: $issued->token,
            httpOnly: true,
            maxAgeMinutes: (int) config('identity.sessions.cookie_max_age_minutes'),
        ));

        $response->headers->setCookie($this->make(
            name: $csrf,
            value: $issued->csrf,
            httpOnly: false,
            maxAgeMinutes: (int) config('identity.sessions.cookie_max_age_minutes'),
        ));

        return $response;
    }

    /** پاک‌کردن هر دو کوکی — مقدار خالی با Max-Age=0. */
    public function clear(Response $response): Response
    {
        $response->headers->setCookie($this->make(
            name: config('identity.cookies.session'),
            value: '',
            httpOnly: true,
            maxAgeMinutes: 0,
        ));

        $response->headers->setCookie($this->make(
            name: config('identity.cookies.csrf'),
            value: '',
            httpOnly: false,
            maxAgeMinutes: 0,
        ));

        return $response;
    }

    private function make(string $name, string $value, bool $httpOnly, int $maxAgeMinutes): Cookie
    {
        return new Cookie(
            name: $name,
            value: $value,
            expire: $maxAgeMinutes > 0 ? time() + ($maxAgeMinutes * 60) : 1,
            path: (string) config('identity.cookies.path', '/'),
            domain: config('identity.cookies.domain'),
            secure: (bool) config('identity.cookies.secure'),
            httpOnly: $httpOnly,
            raw: false,
            sameSite: (string) config('identity.cookies.same_site', 'strict'),
        );
    }
}
