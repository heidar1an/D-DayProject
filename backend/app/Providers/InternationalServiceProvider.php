<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت rate limit های کاتالوگ بین‌الملل — فاز ۱۷.
 *
 * نام‌دار و از `config/international.php`؛ هیچ عددی hardcode نیست. کلید سهمیه
 * HMAC آی‌پی یا شناسهٔ بازیگر است — IP خام هرگز ذخیره/لاگ نمی‌شود (همان الگوی
 * `ExamServiceProvider`).
 *
 * Policy جداگانه‌ای اینجا ثبت نشد: خواندن عمومی است و نوشتن پنل با `api.can`
 * روی کلیدهای واقعی `intl.*` گیت می‌شود. ساختن Policy بی‌مصرف، «طراحی‌شده» را
 * جای «پیاده‌شده» جا می‌زند.
 */
class InternationalServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        foreach ([
            'intl_read' => 'international.rate_limits.read',
            'intl_write' => 'international.rate_limits.write',
        ] as $name => $configKey) {
            $this->named($name, $configKey);
        }
    }

    private function named(string $name, string $configKey): void
    {
        RateLimiter::for($name, function (Request $request) use ($configKey): Limit {
            $config = config($configKey);

            return Limit::perMinutes((int) $config['decay_minutes'], (int) $config['max'])
                ->by($this->actorKey($request))
                ->response(fn (Request $request, array $headers) => ApiResponse::error(
                    'RATE_LIMITED',
                    'Too many requests. Please try again later.',
                    429,
                    [],
                    $headers,
                ));
        });
    }

    private function actorKey(Request $request): string
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if ($admin instanceof Admin) {
            return 'admin:'.$admin->getKey();
        }

        $user = $request->user();

        if ($user instanceof User) {
            return 'user:'.$user->getKey();
        }

        return 'ip:'.hash_hmac('sha256', 'ip:'.(string) $request->ip(), (string) config('app.key'));
    }
}
