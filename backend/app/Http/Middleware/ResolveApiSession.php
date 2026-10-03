<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use App\Models\AuthSession;
use App\Services\Identity\SessionManager;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * سشن را از کوکی می‌خواند و کاربر را روی درخواست می‌نشاند.
 *
 * روی همهٔ مسیرهای `/api/v1` اجرا می‌شود ولی **اختیاری** است: اگر کوکی نباشد
 * هیچ کوئری‌ای زده نمی‌شود و درخواست مهمان ادامه می‌یابد. اجبار به ورود کار
 * `RequireSessionUser` است.
 *
 * Frontend هرگز نمی‌تواند بگوید «من کاربر X هستم»: هویت فقط از اینجا می‌آید.
 */
class ResolveApiSession
{
    /** کلید attribute درخواست که سشنِ فعلی را نگه می‌دارد. */
    public const ATTRIBUTE = 'tapesh.auth_session';

    /**
     * کلید attribute که **فقط** برای principal ادمین ست می‌شود.
     *
     * چرا جدا از `$request->user()`: در این معماری `user()` معنایش «دانشجو» است و
     * نباید با ادمین قاطی شود. یک سشن ادمین هرگز `$request->user()` را پر نمی‌کند،
     * پس هیچ policy یا rate limiter دانشجو اشتباهاً روی ادمین اجرا نمی‌شود.
     */
    public const ADMIN_ATTRIBUTE = 'tapesh.admin';

    public function __construct(private readonly SessionManager $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $cookie = $request->cookie((string) config('identity.cookies.session'));
        $session = is_string($cookie) ? $this->sessions->resolve($cookie) : null;

        if ($session !== null && $session->principal_type === AuthSession::PRINCIPAL_ADMIN) {
            return $this->handleAdmin($request, $next, $session);
        }

        if ($session === null) {
            /*
             * بدون سشن معتبر، هیچ هویتی روی درخواست نمی‌نشیند. پاک‌سازی صریح
             * لازم است: در فرآیندهای بلندعمر (Octane، و همین تست‌ها که اپ را
             * بین درخواست‌ها ری‌بوت نمی‌کنند) گارد بین درخواست‌ها بازاستفاده
             * می‌شود و کاربرِ درخواست قبلی می‌توانست بی‌صدا باقی بماند —
             * یعنی سشن باطل‌شده هنوز «لاگین» به حساب می‌آمد.
             */
            Auth::forgetUser();
            $request->setUserResolver(static fn () => null);

            return $next($request);
        }

        $request->attributes->set(self::ATTRIBUTE, $session);

        $user = $session->user;

        if ($user !== null) {
            Auth::setUser($user);
            $request->setUserResolver(fn () => $user);

            // نوشتن‌ها throttled هستند تا هر درخواست یک UPDATE نشود.
            $this->sessions->touch($session);
            $this->sessions->refresh($session);
        }

        return $next($request);
    }

    /**
     * مسیر ادمین: هویت ادمین روی attribute جدا می‌نشیند و `user()` عمداً خالی
     * می‌ماند. سشن ادمینِ غیرفعال هیچ attribute ای نمی‌گیرد ⇒ `api.admin` ۴۰۱
     * می‌دهد؛ این‌طور غیرفعال‌کردن حساب، سشن‌های باز را هم بی‌اثر می‌کند.
     */
    private function handleAdmin(Request $request, Closure $next, AuthSession $session): Response
    {
        Auth::forgetUser();
        $request->setUserResolver(static fn () => null);

        $admin = $session->admin;

        if ($admin instanceof Admin && $admin->isActive()) {
            $request->attributes->set(self::ATTRIBUTE, $session);
            $request->attributes->set(self::ADMIN_ATTRIBUTE, $admin);
        }

        $this->sessions->touch($session);
        $this->sessions->refresh($session);

        return $next($request);
    }
}
