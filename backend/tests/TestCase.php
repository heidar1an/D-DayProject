<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        /*
         * این پروژه envelope خطای خودش را دارد (`error.fields`) و از کلید
         * پیش‌فرض `errors` لاراول استفاده نمی‌کند. `assertJsonValidationErrors`
         * در نتیجه دنبال `errors` می‌گردد و همیشه شکست می‌خورد — پس یک سنجهٔ
         * درست روی قرارداد واقعی ثبت می‌کنیم.
         */
        TestResponse::macro('assertFieldError', function (string $field): TestResponse {
            /** @var TestResponse $this */
            $this->assertJsonPath('error.code', 'VALIDATION_FAILED');
            $this->assertJsonStructure(['error' => ['fields' => [$field]]]);

            return $this;
        });
    }

    /**
     * هدر `Origin` برای درخواست‌های نوشتاری.
     *
     * چرا در تست لازم است: `EnsureSameOrigin` عمداً fail-closed است و Origin
     * غایب را رد می‌کند — همان رفتاری که در production می‌خواهیم. تست‌ها باید
     * مثل یک مرورگر same-origin رفتار کنند، نه اینکه میان‌افزار را دور بزنند.
     */
    protected function origin(): string
    {
        return 'http://localhost';
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $headers
     */
    protected function postJsonWithOrigin(string $uri, array $data = [], array $headers = [])
    {
        return $this->postJson($uri, $data, ['Origin' => $this->origin(), ...$headers]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $headers
     */
    protected function patchJsonWithOrigin(string $uri, array $data = [], array $headers = [])
    {
        return $this->patchJson($uri, $data, ['Origin' => $this->origin(), ...$headers]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $headers
     */
    protected function putJsonWithOrigin(string $uri, array $data = [], array $headers = [])
    {
        return $this->putJson($uri, $data, ['Origin' => $this->origin(), ...$headers]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $headers
     */
    protected function deleteJsonWithOrigin(string $uri, array $data = [], array $headers = [])
    {
        return $this->deleteJson($uri, $data, ['Origin' => $this->origin(), ...$headers]);
    }

    /**
     * ثبت‌نام از طریق endpoint واقعی (نه ساخت مستقیم در دیتابیس).
     *
     * @param  array<string, mixed>  $payload
     */
    protected function register(array $payload = []): TestResponse
    {
        return $this->postJsonWithOrigin('/api/v1/auth/register', [
            'phone' => '09123456789',
            'password' => 'Tapesh#1402',
            ...$payload,
        ]);
    }

    /**
     * مقادیر خام کوکی‌های هویت از یک پاسخ.
     *
     * `decrypt: false` چون کوکی‌های این پروژه رمزنگاری‌شده نیستند — محرمانگی
     * از `HttpOnly` + `Secure` + هش‌شده‌بودن توکن در دیتابیس می‌آید.
     *
     * @return array{session: string, csrf: string}
     */
    protected function cookiesFrom(TestResponse $response): array
    {
        $session = $response->getCookie((string) config('identity.cookies.session'), false);
        $csrf = $response->getCookie((string) config('identity.cookies.csrf'), false);

        return [
            'session' => (string) ($session?->getValue() ?? ''),
            'csrf' => (string) ($csrf?->getValue() ?? ''),
        ];
    }

    /**
     * درخواست‌های بعدی با همان کوکی‌های سشن/CSRF (بدون رمزنگاری تست‌کلاینت).
     *
     * چرا `withCredentials()`: لاراول در `prepareCookiesForJsonRequest()` کوکی‌ها را
     * فقط وقتی به درخواست JSON می‌چسباند که این پرچم روشن باشد. بدون آن، همهٔ
     * درخواست‌های `getJson`/`patchJson` بی‌کوکی می‌روند و ۴۰۱ می‌گیرند.
     */
    protected function withAuthCookies(TestResponse $response): static
    {
        $cookies = $this->cookiesFrom($response);

        return $this
            ->withCredentials()
            ->withUnencryptedCookies([
                (string) config('identity.cookies.session') => $cookies['session'],
                (string) config('identity.cookies.csrf') => $cookies['csrf'],
            ]);
    }

    /** @return array<string, string> هدر CSRF برای درخواست‌های نوشتاری با سشن */
    protected function csrfHeader(TestResponse $response): array
    {
        return [(string) config('identity.csrf.header') => $this->cookiesFrom($response)['csrf']];
    }

    /**
     * پاک‌کردن کوکی‌های هویت از کلاینت تست ⇒ درخواست بعدی «مهمان» است.
     *
     * چرا لازم است: `withUnencryptedCookies([])` آرایه را **merge** می‌کند و
     * عملاً هیچ کاری نمی‌کند. تنها راه، صفرکردن خود آرایه‌های کلاینت است.
     */
    protected function forgetCookies(): static
    {
        $this->defaultCookies = [];
        $this->unencryptedCookies = [];

        return $this;
    }
}
