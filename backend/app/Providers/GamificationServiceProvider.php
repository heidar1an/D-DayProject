<?php

namespace App\Providers;

use App\Events\Exam\ExamFinished;
use App\Events\GreenPath\GreenPathStepCompleted;
use App\Events\Learning\LessonCompleted;
use App\Events\Learning\StudySessionRecorded;
use App\Events\QuestionBank\QuestionAnswered;
use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Listeners\Gamification\ProcessActivity;
use App\Listeners\GreenPath\SyncLearningActivity;
use App\Models\Admin;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت وابستگی‌های فاز ۱۳ و ۱۴ — مسیر سبز + گیمیفیکیشن.
 *
 *   • دو listener روی همان Domain Eventهای فازهای قبل سوار می‌شوند؛ هیچ
 *     معماری Event جدیدی ساخته نشد.
 *   • rate limitها نام‌دار و از config هستند؛ کلیدشان شناسهٔ بازیگر یا HMAC IP.
 */
class GamificationServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->registerListeners();
        $this->registerRateLimiters();
    }

    private function registerListeners(): void
    {
        /* فاز ۱۳ — مسیر سبز فقط مصرف‌کنندهٔ رخداد واقعی یادگیری است. */
        Event::listen(LessonCompleted::class, SyncLearningActivity::class);
        Event::listen(ExamFinished::class, SyncLearningActivity::class);
        Event::listen(QuestionAnswered::class, SyncLearningActivity::class);

        /* فاز ۱۴ — گیمیفیکیشن روی همان رخدادها + تکمیل قدم مسیر سبز. */
        Event::listen(LessonCompleted::class, ProcessActivity::class);
        Event::listen(QuestionAnswered::class, ProcessActivity::class);
        Event::listen(ExamFinished::class, ProcessActivity::class);
        Event::listen(StudySessionRecorded::class, ProcessActivity::class);
        Event::listen(GreenPathStepCompleted::class, ProcessActivity::class);

        /* ProgressUpdated پاداش ندارد: گذار in_progress پاداش‌آور نیست و
         * completed همان LessonCompleted را می‌فرستد (بدون دوباره‌پاداش). */
    }

    private function registerRateLimiters(): void
    {
        $this->named('greenpath_read', 'green_path.rate_limits.greenpath_read', 'greenpath-read');
        $this->named('greenpath_write', 'green_path.rate_limits.greenpath_write', 'greenpath-write');
        $this->named('league_read', 'gamification.rate_limits.league_read', 'league-read');
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
