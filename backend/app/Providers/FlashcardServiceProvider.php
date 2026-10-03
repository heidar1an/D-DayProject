<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardState;
use App\Models\User;
use App\Policies\FlashcardDeckPolicy;
use App\Policies\FlashcardPolicy;
use App\Policies\FlashcardStatePolicy;
use App\Services\Flashcards\SpacedRepetition\SpacedRepetitionRegistry;
use App\Services\Flashcards\SpacedRepetition\SpacedRepetitionStrategy;
use App\Services\Flashcards\SpacedRepetition\StrategyV1;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت دامنهٔ فلش‌کارت — فاز ۹.
 *
 * سه چیز اینجا قفل می‌شود:
 *   ۱. Policyها (مالکیت دک/کارت/وضعیت).
 *   ۲. **استراتژی‌های Spaced Repetition** — افزودن V2 فقط یعنی یک خط اینجا.
 *   ۳. rate limitهای نام‌دار از `config/flashcards.php`.
 *
 * ⚠️ هیچ side-effect دیگری اینجا نیست؛ هیچ‌کدام از این‌ها در `register()`
 * کار دامنه انجام نمی‌دهند.
 */
class FlashcardServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        /*
         * رجیستری استراتژی‌ها singleton است و **فهرست بسته‌ای** از نسخه‌ها دارد.
         * اگر روزی نسخه‌ای حذف شود، رکوردهای قدیمی با `ALGORITHM_VERSION_UNKNOWN`
         * صریح شکست می‌خورند — نه اینکه بی‌صدا با الگوریتم دیگری بازمحاسبه شوند.
         */
        $this->app->singleton(SpacedRepetitionRegistry::class, function ($app): SpacedRepetitionRegistry {
            /** @var list<SpacedRepetitionStrategy> $strategies */
            $strategies = [
                new StrategyV1,
            ];

            return new SpacedRepetitionRegistry($strategies);
        });
    }

    public function boot(): void
    {
        Gate::policy(FlashcardDeck::class, FlashcardDeckPolicy::class);
        Gate::policy(Flashcard::class, FlashcardPolicy::class);
        Gate::policy(FlashcardState::class, FlashcardStatePolicy::class);

        $this->registerRateLimiters();
    }

    private function registerRateLimiters(): void
    {
        foreach ([
            'flashcards_read' => 'flashcards.rate_limits.read',
            'flashcards_write' => 'flashcards.rate_limits.write',
            'flashcards_review' => 'flashcards.rate_limits.review',
            'admin_flashcards' => 'flashcards.rate_limits.admin',
        ] as $name => $configKey) {
            $this->named($name, $configKey);
        }
    }

    private function named(string $name, string $configKey): void
    {
        RateLimiter::for($name, function (Request $request) use ($configKey): Limit {
            $config = config($configKey);

            /*
             * کلید بدون نام limiter ساخته می‌شود؛ `ThrottleRequests` خودش نام را
             * پیشوند می‌کند. IP خام هرگز ذخیره/لاگ نمی‌شود — هش HMAC می‌شود.
             */
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
