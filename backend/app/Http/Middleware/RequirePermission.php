<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Services\Identity\RbacService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `api.can:testbank.update` — دروازهٔ مجوز.
 *
 * چرا middleware و نه `can:` لاراول: در این معماری `$request->user()` فقط
 * دانشجو است (principal ادمین جدا نگه داشته می‌شود)، پس Gate پیش‌فرض ادمین را
 * نمی‌بیند. این middleware صریح روی همان principal ادمین کار می‌کند.
 *
 * پارامترها با `|` جدا می‌شوند و «هر کدام» کافی است (`api.can:a|b`).
 */
class RequirePermission
{
    public function __construct(private readonly RbacService $rbac) {}

    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            throw ApiErrorException::unauthenticated();
        }

        if ($permissions === [] || ! $this->rbac->allowsAny($admin, $permissions)) {
            throw ApiErrorException::forbidden('You do not have permission to perform this action.');
        }

        return $next($request);
    }
}
