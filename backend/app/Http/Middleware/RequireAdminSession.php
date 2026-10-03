<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\AuthSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * اجبار به «سشن ادمین». آینهٔ `RequireSessionUser` ولی با principal متفاوت.
 *
 * چرا principal جدا چک می‌شود: بدون آن، یک سشن دانشجو می‌توانست از مسیر پنل
 * عبور کند (و برعکس). تنها معیار، سشن سرور است — هیچ هدر/بدنه‌ای نقش ندارد.
 */
class RequireAdminSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $session = $request->attributes->get(ResolveApiSession::ATTRIBUTE);
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $session instanceof AuthSession
            || $session->principal_type !== AuthSession::PRINCIPAL_ADMIN
            || ! $admin instanceof Admin
            || ! $admin->isActive()) {
            throw ApiErrorException::unauthenticated();
        }

        return $next($request);
    }
}
