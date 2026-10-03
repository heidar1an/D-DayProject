<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notes\StoreReviewItemRequest;
use App\Http\Resources\ReviewItemResource;
use App\Services\Notes\ReviewItemService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * آیتم‌های مرور کاربر — فاز ۱۶ (§36).
 *
 *   GET   /api/v1/me/review-items                        فهرست (نزدیک‌ترین due)
 *   POST  /api/v1/me/review-items                        ثبت/به‌روزرسانی (idempotent per source)
 *   PATCH /api/v1/me/review-items/{id}                   ویرایش عنوان/توضیح
 *   POST  /api/v1/me/review-items/{id}/complete-review   مرور کامل شد (G5)
 *   POST  /api/v1/me/review-items/{id}/restart           شروع دوباره
 *   DELETE /api/v1/me/review-items/{id}                  حذف
 */
final class ReviewItemController extends Controller
{
    public function __construct(
        private readonly ReviewItemService $reviews,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $items = ReviewItemResource::collection(
            \App\Models\ReviewItem::query()
                ->where('user_id', $request->user()->getKey())
                ->orderByRaw('status = ? asc', ['mastered'])
                ->orderBy('due_at')
                ->get(),
        );

        return ApiResponse::success(['items' => $items]);
    }

    public function store(StoreReviewItemRequest $request): JsonResponse
    {
        $result = $this->reviews->add($request->user(), $request->validated());

        return ApiResponse::success(
            ['item' => new ReviewItemResource($result['item']), 'idempotent' => $result['idempotent']],
            null,
            $result['idempotent'] ? 200 : 201,
        );
    }

    public function update(StoreReviewItemRequest $request, string $itemId): JsonResponse
    {
        $item = $this->reviews->update($request->user(), $itemId, $request->validated());

        return ApiResponse::success(['item' => new ReviewItemResource($item)]);
    }

    public function completeReview(Request $request, string $itemId): JsonResponse
    {
        $item = $this->reviews->completeReview($request->user(), $itemId);

        return ApiResponse::success(['item' => new ReviewItemResource($item)]);
    }

    public function restart(Request $request, string $itemId): JsonResponse
    {
        $item = $this->reviews->restart($request->user(), $itemId);

        return ApiResponse::success(['item' => new ReviewItemResource($item)]);
    }

    public function destroy(Request $request, string $itemId): JsonResponse
    {
        $this->reviews->delete($request->user(), $itemId);

        return ApiResponse::success(null, null, 204);
    }
}
