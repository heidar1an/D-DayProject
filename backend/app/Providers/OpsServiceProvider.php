<?php

namespace App\Providers;

use App\Events\Exam\ExamFinished;
use App\Http\ApiResponse;
use App\Http\Middleware\ResolveApiSession;
use App\Listeners\Notifications\QueueExamResultNotification;
use App\Models\Admin;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * ثبت دامنه‌های فاز ۱۹/۲۰ — اعلان، جست‌وجو، و پنل مدیریتی.
 *
 * مرزها:
 *   • اعلان/جست‌وجو **مصرف‌کنندهٔ** رخدادهای موجودند؛ معماری Event تازه‌ای
 *     ساخته نشد.
 *   • rate limitهای پنل سخت‌گیرانه‌اند: ارسال گروهی اعلان، rebuild ایندکس و
 *     تغییر تنظیمات امنیتی عملیات پرریسک‌اند (§105).
 *
 * کلید سهمیه: ادمین با شناسهٔ خودش، کاربر سشن، وگرنه HMAC آی‌پی — همان قاعدهٔ
 * فازهای قبل.
 */
class OpsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->registerListeners();
        $this->registerRateLimiters();
    }

    private function registerListeners(): void
    {
        /* فاز ۱۹ — کارنامهٔ آزمون به اعلان کاربر تبدیل می‌شود. */
        Event::listen(ExamFinished::class, QueueExamResultNotification::class);
    }

    private function registerRateLimiters(): void
    {
        foreach ([
            /* مصرف‌کنندهٔ کاربر */
            'notifications_read' => [1, 90],
            'notifications_write' => [1, 60],
            'search_read' => [1, 30],

            /* پنل */
            'admin_dashboard' => [1, 60],
            'admin_users' => [1, 60],
            'admin_audit' => [1, 60],
            'admin_settings_read' => [1, 60],
            'admin_settings_write' => [1, 20],
            'admin_ops_read' => [1, 60],
            'admin_notifications_send' => [1, 10],
            'admin_search_rebuild' => [5, 3],
        ] as $name => [$minutes, $max]) {
            RateLimiter::for($name, function (Request $request) use ($minutes, $max): Limit {
                return Limit::perMinutes($minutes, $max)
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
