<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Commerce\ListCommerceRequest;
use App\Http\Resources\EntitlementResource;
use App\Http\Resources\OrderResource;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\SubscriptionResource;
use App\Services\Commerce\EntitlementService;
use App\Services\Commerce\OrderService;
use App\Services\Commerce\PaymentService;
use App\Services\Commerce\SubscriptionService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * دادهٔ تجاری **کاربر جاری** — فاز ۱۸.
 *
 *   GET /api/v1/me/orders
 *   GET /api/v1/me/orders/{id}
 *   GET /api/v1/me/payments
 *   GET /api/v1/me/subscriptions
 *   GET /api/v1/me/entitlements
 *
 * ⚠️ هیچ‌کدام `userId` نمی‌پذیرند. هویت فقط از سشن می‌آید و سفارش/پرداخت/اشتراک
 * کاربر دیگر ۴۰۴ می‌گیرد (نه ۴۰۳) تا وجودشان لو نرود (§58/§59/§60).
 *
 * `entitlements` **فقط خواندنی** است: هیچ مسیری entitlement نمی‌سازد یا لغو
 * نمی‌کند. ساخت/لغو فقط از `EntitlementService` در مسیر پرداخت تأییدشده.
 */
class MeCommerceController extends Controller
{
    public function __construct(
        private readonly OrderService $orders,
        private readonly PaymentService $payments,
        private readonly SubscriptionService $subscriptions,
        private readonly EntitlementService $entitlements,
    ) {}

    public function orders(ListCommerceRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated()['perPage'] ?? 20);
        $paginator = $this->orders->forUser($request->user(), $perPage);

        return ApiResponse::success(
            ['orders' => OrderResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function order(ListCommerceRequest $request, string $id): JsonResponse
    {
        $order = $this->orders->findOwned($request->user(), $id);

        return ApiResponse::success(['order' => new OrderResource($order)]);
    }

    public function payments(ListCommerceRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated()['perPage'] ?? 20);
        $paginator = $this->payments->forUser($request->user(), $perPage);

        return ApiResponse::success(
            ['payments' => PaymentResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function subscriptions(ListCommerceRequest $request): JsonResponse
    {
        $user = $request->user();

        /*
         * هم‌راستاسازی وضعیت نمایشی: اشتراکی که `ends_at` آن گذشته ولی وضعیتش
         * هنوز `active` است، اینجا `expired` می‌شود. **دسترسی از قبل بسته است**
         * (`ends_at` در entitlement کپی شده و scopeActive آن را نادیده می‌گیرد)؛
         * این فقط گزارش را با واقعیت یکی می‌کند. عملیات idempotent است.
         */
        $this->entitlements->expireLapsedSubscriptions($user);

        return ApiResponse::success([
            'subscriptions' => SubscriptionResource::collection($this->subscriptions->forUser($user)),
        ]);
    }

    public function entitlements(ListCommerceRequest $request): JsonResponse
    {
        return ApiResponse::success([
            'entitlements' => EntitlementResource::collection($this->entitlements->forUser($request->user())),
            /* فهرست قابلیت‌های فعال — همان چیزی که Content از گیت می‌پرسد. */
            'active_capabilities' => $this->entitlements->activeCapabilities($request->user()),
            'enforced' => (bool) config('commerce.entitlements.enforce'),
        ]);
    }
}
