<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Commerce\StoreOrderRequest;
use App\Http\Resources\OrderResource;
use App\Services\Commerce\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * سفارش — فاز ۱۸.
 *
 *   POST /api/v1/orders
 *   POST /api/v1/orders/{id}/cancel
 *
 * `POST /orders` idempotent است: هدر `Idempotency-Key` + `UNIQUE(scope,actor_key,
 * request_key)` در دیتابیس. همان کلید و همان بدنه ⇒ همان سفارش؛ همان کلید و
 * بدنهٔ متفاوت ⇒ ۴۰۹ (§34).
 *
 * ⚠️ هیچ مسیری برای «paid کردن» سفارش وجود ندارد. `paid` فقط از
 * `PaymentService::finalize()` پس از تأیید واقعی درگاه می‌آید (§48/§95).
 */
class OrderController extends Controller
{
    use ReadsIdempotencyKey;

    public function __construct(private readonly OrderService $orders) {}

    public function store(StoreOrderRequest $request): JsonResponse
    {
        $data = $request->validated();

        $outcome = $this->orders->create(
            $request->user(),
            (string) $data['planId'],
            (string) $data['cycleId'],
            (int) ($data['seats'] ?? 1),
            $this->idempotencyKey($request),
        );

        return ApiResponse::success($outcome->data, null, $outcome->status);
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $order = $this->orders->cancel($request->user(), $this->orders->findOwned($request->user(), $id));

        return ApiResponse::success(['order' => (new OrderResource($order->load('lines')))->resolve()]);
    }
}
