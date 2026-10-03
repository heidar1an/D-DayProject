<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use App\Models\User;
use App\Models\WikiArticle;
use App\Models\WikiBookmark;
use App\Models\WikiCategory;
use App\Models\WikiRelation;
use App\Policies\WikiArticlePolicy;
use App\Policies\WikiBookmarkPolicy;
use App\Policies\WikiCategoryPolicy;
use App\Policies\WikiRelationPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت دامنهٔ ویکی — فاز ۱۰.
 *
 * Policyها (دفاع لایهٔ دوم برای خواندن عمومی/مالکیت نشان‌گذاری) و rate limitهای
 * نام‌دار از `config/wiki.php`.
 *
 * ⚠️ **هیچ جدول Knowledge Graph اینجا ثبت/ساخته نمی‌شود.** فاز ۱۱ مالک آن است و
 * این provider فقط Policyهای ویکی را می‌شناسد.
 */
class WikiServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(WikiArticle::class, WikiArticlePolicy::class);
        Gate::policy(WikiCategory::class, WikiCategoryPolicy::class);
        Gate::policy(WikiRelation::class, WikiRelationPolicy::class);
        Gate::policy(WikiBookmark::class, WikiBookmarkPolicy::class);

        $this->registerRateLimiters();
    }

    private function registerRateLimiters(): void
    {
        foreach ([
            'wiki_read' => 'wiki.rate_limits.read',
            'wiki_search' => 'wiki.rate_limits.search',
            'wiki_bookmark' => 'wiki.rate_limits.bookmark',
            'admin_wiki' => 'wiki.rate_limits.admin',
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

    /**
     * کلید سهمیه: کاربر سشن اگر باشد، ادمین با شناسهٔ خودش، وگرنه هش HMAC آی‌پی.
     * محتوای ویکی عمومی است، پس محدودیت‌ها سخاوتمندانه‌اند؛ ولی خواندن
     * بی‌حساب‌وکتاب هم نباید رایگان باشد.
     */
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
