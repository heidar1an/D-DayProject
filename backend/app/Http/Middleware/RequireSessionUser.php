<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiErrorException;
use App\Models\AuthSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * اجبار به ورود. تنها معیار، **سشن سرور** است که `ResolveApiSession` روی
 * درخواست نشانده — نه هیچ فیلدی در body/query. `GET /me?userId=…` هیچ اثری ندارد.
 *
 * چرا علاوه بر `$request->user()` وجود سشن هم چک می‌شود: کاربرِ احرازشده فقط
 * وقتی معتبر است که از یک سشن فعال آمده باشد. این‌طور هیچ مسیر دیگری (یا حالت
 * باقی‌ماندهٔ گارد) نمی‌تواند به‌تنهایی «ورود» بسازد.
 */
class RequireSessionUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $session = $request->attributes->get(ResolveApiSession::ATTRIBUTE);

        // principal باید صریحاً «دانشجو» باشد: سشن ادمین نباید از مسیر دانشجو
        // عبور کند (و برعکس). بدون این چک، یک سشن ادمین `user()` را پر می‌کرد و
        // مثلاً `GET /me/progress` پیشرفت ادمین را با شناسهٔ ادمین می‌ساخت.
        if (! $session instanceof AuthSession
            || $session->principal_type !== AuthSession::PRINCIPAL_USER
            || $request->user() === null) {
            throw ApiErrorException::unauthenticated();
        }

        return $next($request);
    }
}
