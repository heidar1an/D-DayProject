<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\AuthSession;
use App\Services\Identity\AuthenticationService;
use App\Services\Identity\RegistrationService;
use App\Services\Identity\SessionCookies;
use App\Services\Identity\SessionManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ثبت‌نام / ورود / خروج.
 *
 * قرارداد پاسخ‌ها (جزئیات: `docs/auth.md` و `docs/openapi.v1.json`):
 *   POST /api/v1/auth/register → 201 `{data:{user},requestId}` + کوکی سشن
 *   POST /api/v1/auth/login    → 200 `{data:{user},requestId}` + کوکی سشن
 *   POST /api/v1/auth/logout   → 200 `{data:{ok:true},requestId}` + کوکی پاک
 *
 * توکن خام سشن هرگز در بدنهٔ پاسخ نمی‌آید؛ فقط در کوکی HttpOnly.
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly RegistrationService $registrations,
        private readonly AuthenticationService $authentications,
        private readonly SessionManager $sessions,
        private readonly SessionCookies $cookies,
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->registrations->register($request->validated());

        $response = ApiResponse::success(['user' => new UserResource($result['user'])], null, 201);

        return $this->cookies->attach($response, $result['issued']);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();

        $result = $this->authentications->attempt(
            (string) ($data['identity'] ?? $data['phone'] ?? ''),
            (string) $data['password'],
            $this->currentSession($request),
        );

        // ورود باید همان شکل پاسخ ثبت‌نام را بدهد؛ بدون این، `profile` در پاسخ
        // غایب می‌شد و کلاینت دو قرارداد متفاوت برای یک کاربر می‌دید.
        $result['user']->loadMissing('profile.university');

        $response = ApiResponse::success(['user' => new UserResource($result['user'])]);

        return $this->cookies->attach($response, $result['issued']);
    }

    /**
     * خروج سرور-کنترل‌شده: سشن فعلی باطل و کوکی‌ها پاک می‌شوند.
     * بدون سشن هم ۲۰۰ می‌دهد (idempotent) — خروج دوباره خطا نیست.
     */
    public function logout(Request $request): JsonResponse
    {
        $this->sessions->revoke($this->currentSession($request));

        return $this->cookies->clear(ApiResponse::success(['ok' => true]));
    }

    private function currentSession(Request $request): ?AuthSession
    {
        $session = $request->attributes->get(ResolveApiSession::ATTRIBUTE);

        return $session instanceof AuthSession ? $session : null;
    }
}
