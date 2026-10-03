<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Flashcards\ReviewFlashcardRequest;
use App\Http\Requests\Flashcards\ReviewQueueRequest;
use App\Http\Resources\FlashcardProgressResource;
use App\Http\Resources\FlashcardQueueItemResource;
use App\Http\Resources\FlashcardReviewResultResource;
use App\Models\Flashcard;
use App\Models\FlashcardState;
use App\Models\User;
use App\Services\Flashcards\FlashcardReviewService;
use App\Services\Flashcards\FlashcardStateRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * مرور — فاز ۹.
 *
 *   GET  /api/v1/flashcards/review/queue      صف مرور (due + نو)
 *   POST /api/v1/flashcards/review/{cardId}   ثبت مرور (idempotent)
 *   GET  /api/v1/flashcards/progress          پیشرفت مشتق‌شده
 *
 * مرز اعتماد: بدنهٔ مرور فقط `rating` و `requestKey` است. Controller هیچ
 * الگوریتمی اجرا نمی‌کند؛ فقط سرویس را صدا می‌زند (§13).
 */
class FlashcardReviewController extends Controller
{
    public function __construct(
        private readonly FlashcardReviewService $reviews,
        private readonly FlashcardStateRepository $states,
    ) {}

    public function queue(ReviewQueueRequest $request): JsonResponse
    {
        $user = $request->user();
        $items = $this->reviews->queue($user, $request->validated());

        $payload = [];

        foreach ($items as $item) {
            /** @var Flashcard $card */
            $card = $item['card'];
            /** @var FlashcardState|null $state */
            $state = $item['state'];

            /*
             * پیش‌نمایش برای کارت نو روی یک وضعیت **ذخیره‌نشده** حساب می‌شود؛
             * دیدن صف نباید هیچ ردیف وضعیتی بسازد.
             */
            $payload[] = [
                'card' => $card,
                'state' => $state,
                'preview' => $this->reviews->preview($state ?? $this->fresh($user, $card)),
            ];
        }

        return ApiResponse::success(
            ['queue' => FlashcardQueueItemResource::collection($payload)],
            ['count' => count($payload)],
        );
    }

    public function review(ReviewFlashcardRequest $request, string $cardId): JsonResponse
    {
        $outcome = $this->reviews->review(
            $request->user(),
            $cardId,
            $request->validated(),
            fn (array $payload): array => [
                'review' => (new FlashcardReviewResultResource($payload))->resolve(),
            ],
        );

        return ApiResponse::success($outcome->data, $outcome->meta, $outcome->status);
    }

    public function progress(Request $request): JsonResponse
    {
        return ApiResponse::success([
            'progress' => (new FlashcardProgressResource($this->reviews->progress($request->user())))->resolve(),
        ]);
    }

    private function fresh(User $user, Flashcard $card): FlashcardState
    {
        return $this->states->fresh($user, $card);
    }
}
