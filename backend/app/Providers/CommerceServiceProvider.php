<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use App\Models\User;
use App\Services\Content\CommerceEntitlementGate;
use App\Services\Content\EntitlementGate;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * دامنهٔ Commerce — فاز ۱۸.
 *
 * دو کار انجام می‌دهد:
 *
 *   ۱. **تصاحب بایند `EntitlementGate`.** از فاز ۵ این interface وجود داشت و
 *      بایندش `NullEntitlementGate` (no-op صریح) بود؛ سند خودش می‌گفت «فاز ۱۸
 *      مالک این دامنه است». اکنون `CommerceEntitlementGate` بایند می‌شود.
 *      رفتار عوض **نمی‌شود** مگر `commerce.entitlements.enforce` روشن شود؛ تا
 *      آن زمان `isEnforcing()` همان `false` صادقانه را برمی‌گرداند.
 *
 *   ۲. **rate limit های نام‌دار** از `config/commerce.php`. هیچ عددی hardcode
 *      نیست و IP خام ذخیره/لاگ نمی‌شود.
 *
 * ⚠️ Policy جداگانه برای Order/Payment ثبت نشد: مالکیت در همین لایه با
 * **کوئری محدود به کاربر سشن** چک می‌شود و پاسخ «مال کسی دیگر» **۴۰۴** است، نه
 * ۴۰۳ (همان قاعدهٔ `ExamAttemptService`؛ ۴۰۳ وجود رکورد را تأیید می‌کند و
 * شمارش را ممکن می‌سازد). مسیر `paid` شدن هم هیچ‌وقت از کلاینت نمی‌آید.
 */
class CommerceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(EntitlementGate::class, CommerceEntitlementGate::class);
    }

    public function boot(): void
    {
        foreach ([
            'pricing_plans' => 'commerce.rate_limits.plans',
            'pricing_quote' => 'commerce.rate_limits.quote',
            'commerce_orders' => 'commerce.rate_limits.orders',
            'commerce_payments' => 'commerce.rate_limits.payments',
            'commerce_me' => 'commerce.rate_limits.me',
            'payment_webhook' => 'commerce.rate_limits.webhook',
        ] as $name => $configKey) {
            $this->named($name, $configKey);
        }
    }

    private function named(string $name, string $configKey): void
    {
        RateLimiter::for($name, function (Request $request) use ($configKey, $name): Limit {
            $config = config($configKey);

            return Limit::perMinutes((int) $config['decay_minutes'], (int) $config['max'])
                ->by($this->actorKey($request, $name))
                ->response(fn (Request $request, array $headers) => ApiResponse::error(
                    'RATE_LIMITED',
                    'Too many requests. Please try again later.',
                    429,
                    [],
                    $headers,
                ));
        });
    }

    /**
     * کلید سهمیه.
     *
     * برای webhook، provider در مسیر است: سهمیهٔ هر درگاه جدا حساب می‌شود تا
     * ترافیک یک درگاه، سهمیهٔ دیگری را نخورد و retry قانونی رد نشود.
     */
    private function actorKey(Request $request, string $name): string
    {
        $prefix = $name === 'payment_webhook'
            ? 'webhook:'.(string) $request->route('provider').':'
            : '';

        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if ($admin instanceof Admin) {
            return $prefix.'admin:'.$admin->getKey();
        }

        $user = $request->user();

        if ($user instanceof User) {
            return $prefix.'user:'.$user->getKey();
        }

        return $prefix.'ip:'.hash_hmac('sha256', 'ip:'.(string) $request->ip(), (string) config('app.key'));
    }
}
