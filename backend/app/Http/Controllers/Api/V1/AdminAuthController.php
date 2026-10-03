<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\Admin\AdminLoginRequest;
use App\Http\Resources\AdminResource;
use App\Models\Admin;
use App\Models\AuthSession;
use App\Services\Identity\AdminAuthenticationService;
use App\Services\Identity\SessionCookies;
use App\Services\Identity\SessionManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ورود / خروج / هویت ادمین پنل.
 *
 *   POST /api/v1/admin/auth/login  → 200 `{data:{admin}}` + کوکی سشن ادمین
 *   POST /api/v1/admin/auth/logout → 200 `{data:{ok:true}}` + کوکی پاک
 *   GET  /api/v1/admin/auth/me     → 200 `{data:{admin}}`
 *
 * کوکی **همان** کوکی سشن دانشجوست ولی سشن‌ها دو principal جدا دارند؛ یک
 * دانشجو نمی‌تواند از مسیر پنل عبور کند و برعکس. توکن خام هرگز در بدنه نمی‌آید.
 */
class AdminAuthController extends Controller
{
    public function __construct(
        private readonly AdminAuthenticationService $authentications,
        private readonly SessionManager $sessions,
        private readonly SessionCookies $cookies,
    ) {}

    public function login(AdminLoginRequest $request): JsonResponse
    {
        $data = $request->validated();

        $result = $this->authentications->attempt(
            (string) $data['username'],
            (string) $data['password'],
            $this->currentSession($request),
        );

        $result['admin']->loadMissing('roles');

        $response = ApiResponse::success(['admin' => new AdminResource($result['admin'])]);

        return $this->cookies->attach($response, $result['issued']);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->sessions->revoke($this->currentSession($request));

        return $this->cookies->clear(ApiResponse::success(['ok' => true]));
    }

    public function me(Request $request): JsonResponse
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            return ApiResponse::error('UNAUTHENTICATED', 'Unauthenticated.', 401);
        }

        $admin->loadMissing('roles');

        return ApiResponse::success(['admin' => new AdminResource($admin)]);
    }

    private function currentSession(Request $request): ?AuthSession
    {
        $session = $request->attributes->get(ResolveApiSession::ATTRIBUTE);

        return $session instanceof AuthSession ? $session : null;
    }
}
