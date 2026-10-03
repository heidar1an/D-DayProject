<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Api\V1\Admin\Concerns\ResolvesAdmin;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListUsersRequest;
use App\Http\Resources\UserAdminResource;
use App\Services\Admin\AdminUserQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * مدیریت کاربران در پنل — فاز ۲۰ (§75/§76).
 *
 * فقط **خواندن** و جست‌وجو. هیچ endpoint حذف/تغییر نقش در این فاز ساخته نشد
 * چون UI مصرف‌کنندهٔ واقعی ندارد و `users.delete` در `ADMIN_DENIED` است (§76).
 * دادهٔ حساس (هش رمز، subject گوگل، توکن سشن) هرگز خوانده نمی‌شود (§101).
 */
final class AdminUserController extends Controller
{
    use ResolvesAdmin;

    public function __construct(
        private readonly AdminUserQueryService $users,
    ) {}

    public function index(ListUsersRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated('perPage') ?? config('admin.pagination.users_per_page'));

        $paginator = $this->users->list($request->validated(), $perPage);

        $items = collect($paginator->items())
            ->map(fn ($user) => new UserAdminResource($user, $this->users->hasGoogleLinked((string) $user->getKey())))
            ->values()
            ->all();

        return ApiResponse::success(['users' => $items], Pagination::meta($paginator));
    }

    public function show(string $id): JsonResponse
    {
        $user = $this->users->find($id);

        if ($user === null) {
            abort(404);
        }

        return ApiResponse::success([
            'user' => new UserAdminResource($user, $this->users->hasGoogleLinked($id)),
        ]);
    }
}
