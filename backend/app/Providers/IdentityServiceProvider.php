<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Services\Identity\ClientFingerprint;
use App\Services\Identity\Google\GoogleIdentityProvider;
use App\Services\Identity\Google\UnconfiguredGoogleProvider;
use Closure;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت وابستگی‌ها و سیاست‌های ماژول هویت.
 *
 * rate limit ها **نام‌دار** هستند و روی route ها با `throttle:name` اعمال
 * می‌شوند. کلیدها بر پایهٔ HMAC آی‌پی است، نه IP خام (قاعدهٔ پروژه: IP ذخیره/لاگ
 * نمی‌شود). برای login کلید دوم «identity + IP» است تا یک مهاجم نتواند با عوض
 * کردن IP روی یک حساب خاص حمله کند.
 *
 * همهٔ سقف‌ها از `config/identity.php` می‌آیند — هیچ عددی اینجا hardcode نیست.
 */
class IdentityServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        /*
         * ⚠️ هیچ پیاده‌سازی واقعی گوگل در این فاز وجود ندارد. بایند همیشه
         * `UnconfiguredGoogleProvider` است تا اگر روزی credential اضافه شد،
         * به‌طور خودکار «ورود واقعی» از آب در نیاید؛ باید صریحاً یک
         * پیاده‌سازی نوشته و اینجا جایگزین شود (BluePrint §18).
         */
        $this->app->singleton(GoogleIdentityProvider::class, UnconfiguredGoogleProvider::class);
    }

    public function boot(): void
    {
        $this->registerRateLimiters();
        $this->warnAboutGoogleConfiguration();
    }

    private function registerRateLimiters(): void
    {
        RateLimiter::for('auth-register', function (Request $request): Limit {
            $config = config('identity.rate_limits.register');

            return Limit::perMinutes((int) $config['decay_minutes'], (int) $config['max'])
                ->by('register:'.$this->ipKey($request))
                ->response($this->tooManyRequests());
        });

        RateLimiter::for('auth-login', function (Request $request): array {
            $config = config('identity.rate_limits.login');
            $decay = (int) $config['decay_minutes'];
            $max = (int) $config['max'];
            $ip = $this->ipKey($request);
            $identity = mb_strtolower(trim((string) ($request->input('identity') ?? $request->input('phone') ?? '')));

            return [
                // سقف دقیق روی «این identity از این IP»
                Limit::perMinutes($decay, $max)->by('login:'.$ip.':'.hash('sha256', $identity))->response($this->tooManyRequests()),
                // سقف پهن‌تر روی کل IP (ضد تلاش روی چند حساب از یک مبدأ)
                Limit::perMinutes($decay, $max * 3)->by('login-ip:'.$ip)->response($this->tooManyRequests()),
            ];
        });

        RateLimiter::for('auth-logout', fn (Request $request): Limit => Limit::perMinutes(
            (int) config('identity.rate_limits.logout.decay_minutes'),
            (int) config('identity.rate_limits.logout.max'),
        )->by('logout:'.$this->ipKey($request))->response($this->tooManyRequests()));

        RateLimiter::for('me', fn (Request $request): Limit => Limit::perMinutes(
            (int) config('identity.rate_limits.me.decay_minutes'),
            (int) config('identity.rate_limits.me.max'),
        )->by('me:'.$this->ipKey($request))->response($this->tooManyRequests()));

        RateLimiter::for('profile', fn (Request $request): Limit => Limit::perMinutes(
            (int) config('identity.rate_limits.profile.decay_minutes'),
            (int) config('identity.rate_limits.profile.max'),
        )->by('profile:'.$this->ipKey($request))->response($this->tooManyRequests()));

        RateLimiter::for('universities', fn (Request $request): Limit => Limit::perMinutes(
            (int) config('identity.rate_limits.universities.decay_minutes'),
            (int) config('identity.rate_limits.universities.max'),
        )->by('universities:'.$this->ipKey($request))->response($this->tooManyRequests()));

        // ── پنل (فاز ۳) ────────────────────────────────────────────────────
        RateLimiter::for('admin-login', function (Request $request): array {
            $config = config('admin.rate_limits.login');
            $decay = (int) $config['decay_minutes'];
            $max = (int) $config['max'];
            $ip = $this->ipKey($request);
            $username = mb_strtolower(trim((string) $request->input('username', '')));

            return [
                Limit::perMinutes($decay, $max)->by('admin-login:'.$ip.':'.hash('sha256', $username))->response($this->tooManyRequests()),
                Limit::perMinutes($decay, $max * 3)->by('admin-login-ip:'.$ip)->response($this->tooManyRequests()),
            ];
        });

        RateLimiter::for('admin-logout', fn (Request $request): Limit => Limit::perMinutes(
            (int) config('admin.rate_limits.logout.decay_minutes'),
            (int) config('admin.rate_limits.logout.max'),
        )->by('admin-logout:'.$this->ipKey($request))->response($this->tooManyRequests()));

        RateLimiter::for('admin-me', fn (Request $request): Limit => Limit::perMinutes(
            (int) config('admin.rate_limits.me.decay_minutes'),
            (int) config('admin.rate_limits.me.max'),
        )->by('admin-me:'.$this->ipKey($request))->response($this->tooManyRequests()));
    }

    private function ipKey(Request $request): string
    {
        return $this->app->make(ClientFingerprint::class)->ipHash($request);
    }

    private function tooManyRequests(): Closure
    {
        return fn (Request $request, array $headers) => ApiResponse::error(
            'RATE_LIMITED',
            'Too many requests. Please try again later.',
            429,
            [],
            $headers,
        );
    }

    /**
     * اگر روزی credential گوگل ست شود ولی پیاده‌سازی واقعی نوشته نشده باشد،
     * این هشدار جلوی «تصور اینکه گوگل کار می‌کند» را می‌گیرد.
     * هیچ مقدار secret لاگ نمی‌شود — فقط وجود/عدم وجود آن.
     */
    private function warnAboutGoogleConfiguration(): void
    {
        $configured = config('identity.google.client_id') !== null && config('identity.google.client_secret') !== null;

        if ($configured) {
            Log::channel('api')->warning('identity.google.credentials_present_without_provider_implementation');
        }
    }
}
