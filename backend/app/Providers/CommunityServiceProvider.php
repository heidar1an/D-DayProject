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
 * ثبت دامنه‌های فاز ۱۵/۱۶ — rate limitهای نام‌دار.
 *
 * مرز: Media/References/Anatomy (فاز ۱۵) و Articles/Notes/Review/Groups/
 * Feedback (فاز ۱۶) هرکدام سهمیهٔ خودشان را دارند؛ «گروه‌ها» و «بازخورد»
 * سخت‌گیرانه‌اند (join/rotation/ارسال گزارش قابل abuse هستند — §60).
 *
 * کلید سهمیه: کاربر سشن، ادمین با شناسهٔ خودش، وگرنه هش HMAC آی‌پی — همان
 * قاعدهٔ ویکی.
 */
class CommunityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->registerRateLimiters();
    }

    private function registerRateLimiters(): void
    {
        foreach ([
            'media_access' => [1, 60],
            'media_stream' => [1, 120],
            'media_admin' => [1, 60],
            'references_read' => [1, 60],
            'references_admin' => [1, 60],
            'anatomy_read' => [1, 60],
            'anatomy_admin' => [1, 60],
            'articles_read' => [1, 60],
            'articles_admin' => [1, 60],
            'article_bookmark' => [1, 60],
            'notes_write' => [1, 120],
            'review_write' => [1, 120],
            'groups_read' => [1, 60],
            'groups_write' => [1, 10],
            'groups_join' => [1, 5],
            'feedback_submit' => [1, 5],
            'feedback_read' => [1, 60],
            'feedback_admin' => [1, 60],
        ] as $name => [$minutes, $max]) {
            RateLimiter::for($name, function (Request $request) use ($name, $minutes, $max): Limit {
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
