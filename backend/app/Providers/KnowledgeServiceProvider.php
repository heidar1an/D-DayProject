<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use App\Models\User;
use App\Policies\KnowledgeEdgePolicy;
use App\Policies\KnowledgeNodePolicy;
use App\Services\Knowledge\KnowledgeGraphService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت دامنهٔ گراف دانش — فاز ۱۲.
 *
 * Policyها (لایهٔ دوم دفاعی برای دیدِ عمومی) و rate limitهای نام‌دار از
 * `config/knowledge.php`.
 *
 * مرز دامنه: این provider فقط جدول‌های خود گراف را می‌شناسد. ویکی مالک
 * `wiki_articles` می‌ماند؛ گراف فقط با شناسه به آن reference دارد (§17) و
 * **هیچ** مسیر نوشتنی ویکی از این‌جا عبور نمی‌کند.
 */
class KnowledgeServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(KnowledgeNode::class, KnowledgeNodePolicy::class);
        Gate::policy(KnowledgeEdge::class, KnowledgeEdgePolicy::class);

        // سقف‌های گراف از config می‌آیند؛ سرویس با پارامترهای خام قابل‌تزریق
        // نیست — بایند یکتا در provider.
        $this->app->singleton(KnowledgeGraphService::class, fn () => KnowledgeGraphService::fromConfig());

        $this->registerRateLimiters();
    }

    private function registerRateLimiters(): void
    {
        foreach ([
            'knowledge_read' => 'knowledge.rate_limits.read',
            'admin_knowledge' => 'knowledge.rate_limits.admin',
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
     * کلید سهمیه: ادمین با شناسهٔ خود، کاربر سشن اگر باشد، وگرنه هش HMAC آی‌پی.
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
