<?php

namespace App\Providers;

use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use App\Models\LearningProgress;
use App\Models\Question;
use App\Models\QuestionAttempt;
use App\Models\QuestionReport;
use App\Models\User;
use App\Policies\ProgressPolicy;
use App\Policies\QuestionAttemptPolicy;
use App\Policies\QuestionPolicy;
use App\Policies\QuestionReportPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت وابستگی‌ها و Policyهای فاز ۵ و ۶.
 *
 * rate limit ها **نام‌دار** و از config هستند. کلیدشان HMAC آی‌پی یا شناسهٔ
 * بازیگر است — IP خام هرگز ذخیره/لاگ نمی‌شود.
 */
class LearningServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        /*
         * ⚠️ بایند `EntitlementGate` اینجا **نیست**. فاز ۱۸ مالک این دامنه شد و
         * `CommerceServiceProvider` پیاده‌سازی واقعی
         * (`CommerceEntitlementGate`) را ثبت می‌کند.
         *
         * چرا از اینجا برداشته شد: اگر دو provider یک abstract را ثبت کنند،
         * «آخری برنده است» و ترتیب ثبت در `bootstrap/providers.php` تعیین‌کننده
         * می‌شود — یعنی یک جزئیات چیدمانی می‌تواند بی‌صدا برندهٔ اشتباه را
         * انتخاب کند. حالا یک ثبت و یک مالک صریح وجود دارد.
         *
         * تا وقتی `commerce.entitlements.enforce` روشن نشده، گیت همان رفتار
         * no-op را دارد (`isEnforcing() === false`) و هیچ محتوایی قفل نمی‌شود.
         */
    }

    public function boot(): void
    {
        Gate::policy(LearningProgress::class, ProgressPolicy::class);
        Gate::policy(Question::class, QuestionPolicy::class);
        Gate::policy(QuestionAttempt::class, QuestionAttemptPolicy::class);
        Gate::policy(QuestionReport::class, QuestionReportPolicy::class);

        $this->registerRateLimiters();
    }

    private function registerRateLimiters(): void
    {
        $this->named('content_read', 'content.rate_limits.read', 'content-read');
        $this->named('progress_read', 'learning.rate_limits.progress_read', 'progress-read');
        $this->named('progress_write', 'learning.rate_limits.progress_write', 'progress-write');
        $this->named('study_session', 'learning.rate_limits.study_session', 'study-session');
        $this->named('questions_read', 'question_bank.rate_limits.read', 'questions-read');
        $this->named('questions_answer', 'question_bank.rate_limits.answer', 'questions-answer');
        $this->named('questions_report', 'question_bank.rate_limits.report', 'questions-report');
        $this->named('bank_session', 'question_bank.rate_limits.bank_session', 'bank-session');
        $this->named('admin_questions', 'question_bank.rate_limits.admin', 'admin-questions');
    }

    private function named(string $name, string $configKey, string $prefix): void
    {
        RateLimiter::for($name, function (Request $request) use ($configKey, $prefix): Limit {
            $config = config($configKey);

            return Limit::perMinutes((int) $config['decay_minutes'], (int) $config['max'])
                ->by($prefix.':'.$this->actorKey($request))
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
     * کلید سهمیه: کاربرِ سشن اگر باشد، وگرنه هش آی‌پی. ادمین با شناسهٔ خودش
     * سهمیهٔ جدا دارد تا سهمیهٔ دانشجوها را نخورد.
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
