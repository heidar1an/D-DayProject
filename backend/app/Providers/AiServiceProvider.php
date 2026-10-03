<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Models\User;
use App\Services\Ai\AiProvider;
use App\Services\Ai\UnconfiguredAiProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * دامنهٔ AI — فاز ۲۱.
 *
 * دو چیز:
 *   ۱. بایند `AiProvider`. چون هیچ provider واقعی در پروژه پیکربندی نشده،
 *      بایند پیش‌فرض `UnconfiguredAiProvider` است که صریحاً ۵۰۳ می‌دهد — نه
 *      پاسخ جعلی، نه mock پنهان.
 *   ۲. rate limitهای نام‌دار. هر limiter یک `Limit` برمی‌گرداند (چرا یک و نه
 *      آرایه: `ThrottleRequests` با آرایهٔ Limitها سقف را از اولین عضو
 *      می‌گیرد و لایهٔ دوم عملاً اعمال نمی‌شود)؛ مسیر با `throttle:a,b` هر دو
 *      را کنار هم اعمال می‌کند. IP خام ذخیره/لاگ نمی‌شود.
 */
final class AiServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(AiProvider::class, UnconfiguredAiProvider::class);
    }

    public function boot(): void
    {
        $this->named('ai_chat', 'ai.rate_limits.user_per_minute', userScoped: true);
        $this->named('ai_chat_ip', 'ai.rate_limits.ip_per_minute');
        $this->named('ai_upload', 'ai.rate_limits.upload_per_minute', userScoped: true);
        $this->named('ai_upload_ip', 'ai.rate_limits.ip_per_minute');
    }

    private function named(string $name, string $configKey, bool $userScoped = false): void
    {
        RateLimiter::for($name, function (Request $request) use ($configKey, $name, $userScoped): Limit {
            $user = $request->user();
            $actor = $userScoped && $user instanceof User
                ? 'user:'.$user->getKey()
                : 'ip:'.hash_hmac('sha256', 'ip:'.(string) $request->ip(), (string) config('app.key'));

            return Limit::perMinute(max(1, (int) config($configKey)))
                ->by($name.':'.$actor)
                ->response(fn (Request $request, array $headers) => ApiResponse::error(
                    'AI_RATE_LIMITED',
                    'Too many AI requests. Please try again later.',
                    429,
                    [],
                    $headers,
                ));
        });
    }
}
