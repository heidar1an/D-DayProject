<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notifications\ListNotificationsRequest;
use App\Http\Resources\NotificationResource;
use App\Models\User;
use App\Services\Notifications\NotificationService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * اعلان‌های کاربر — فاز ۱۹ (§23/§24/§25/§26).
 *
 * مالکیت فقط از سشن می‌آید؛ هیچ `userId` از بدنه یا query خوانده نمی‌شود (§11).
 * اعلان کاربر دیگر ⇒ ۴۰۴ (نه ۴۰۳) تا وجود شناسه افشا نشود.
 *
 * Controller هیچ منطقی ندارد: سرویس مالک ساخت/خواندن است (§22).
 */
final class NotificationController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function index(ListNotificationsRequest $request): JsonResponse
    {
        $user = $this->user($request);

        $perPage = (int) ($request->validated('perPage') ?? config('notifications.pagination.per_page'));

        $paginator = $this->notifications->listForUser($user, $perPage, $request->validated('type'));

        return ApiResponse::success(
            [
                'notifications' => NotificationResource::collection($paginator->items()),
                'unreadCount' => $this->notifications->unreadCount($user),
            ],
            Pagination::meta($paginator),
        );
    }

    public function read(Request $request, string $id): JsonResponse
    {
        $notification = $this->notifications->markRead($this->user($request), $id);

        return ApiResponse::success(['notification' => new NotificationResource($notification)]);
    }

    public function readAll(Request $request): JsonResponse
    {
        $marked = $this->notifications->markAllRead($this->user($request));

        return ApiResponse::success(['marked' => $marked]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(401);
        }

        return $user;
    }
}
