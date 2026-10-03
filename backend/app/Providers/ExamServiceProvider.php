<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Policies\ExamAttemptPolicy;
use App\Policies\ExamPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت Policyها و rate limit های Exam Engine — فاز ۷.
 *
 * rate limit ها **نام‌دار** و از `config/exam.php` هستند؛ اعداد عیناً همان
 * اعداد لایهٔ legacy (`database/examApi.js`) تا رفتار پیش از cutover عوض نشود.
 *
 * کلید سهمیه HMAC آی‌پی یا شناسهٔ بازیگر است — IP خام هرگز ذخیره/لاگ نمی‌شود.
 */
class ExamServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(Exam::class, ExamPolicy::class);
        Gate::policy(ExamAttempt::class, ExamAttemptPolicy::class);

        $this->registerRateLimiters();
    }

    private function registerRateLimiters(): void
    {
        foreach ([
            'exam_read' => 'exam.rate_limits.read',
            'exam_registration' => 'exam.rate_limits.registration',
            'exam_attempt_start' => 'exam.rate_limits.attempt_start',
            'exam_answer' => 'exam.rate_limits.answer',
            'exam_finish' => 'exam.rate_limits.finish',
            'exam_result' => 'exam.rate_limits.result',
            'exam_ranking' => 'exam.rate_limits.ranking',
            'analytics_read' => 'analytics.rate_limits.read',
        ] as $name => $configKey) {
            $this->named($name, $configKey);
        }
    }

    private function named(string $name, string $configKey): void
    {
        RateLimiter::for($name, function (Request $request) use ($configKey): Limit {
            $config = config($configKey);

            /*
             * کلید را **بدون** نام limiter می‌سازیم: خودِ `ThrottleRequests`
             * نام را پیشوند می‌کند (`{name}:{key}`). اگر اینجا هم نام را
             * بگذاشتیم، کلید دو بار تکرار می‌شد.
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

    /**
     * کلید سهمیه: ادمین با شناسهٔ خودش، بعد کاربر، وگرنه هش آی‌پی.
     *
     * چرا ادمین جدا: عملیات پنل نباید سهمیهٔ دانشجوها را بخورد (و برعکس).
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
