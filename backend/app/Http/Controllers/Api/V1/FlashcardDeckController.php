<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Flashcards\CreateDeckRequest;
use App\Http\Requests\Flashcards\ListDecksRequest;
use App\Http\Requests\Flashcards\UpdateDeckRequest;
use App\Http\Resources\FlashcardDeckResource;
use App\Models\FlashcardDeck;
use App\Services\Flashcards\FlashcardDeckService;
use App\Services\Flashcards\FlashcardQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * دک‌های فلش‌کارت — فاز ۹.
 *
 *   GET    /api/v1/flashcards/decks            فهرست (شخصی + رسمی منتشرشده)
 *   POST   /api/v1/flashcards/decks            ساخت دک شخصی
 *   GET    /api/v1/flashcards/decks/{id}       یک دک
 *   PATCH  /api/v1/flashcards/decks/{id}       ویرایش دک شخصی
 *   DELETE /api/v1/flashcards/decks/{id}       حذف دک **خالی**
 *   POST   /api/v1/flashcards/decks/{id}/clone کلون دک رسمی به دک شخصی
 *
 * هیچ مسیری `userId` نمی‌پذیرد و دک رسمی از اینجا تغییر نمی‌کند: مسیر
 * `/admin/flashcards/*` مالک آن است.
 */
class FlashcardDeckController extends Controller
{
    public function __construct(
        private readonly FlashcardDeckService $decks,
        private readonly FlashcardQueryService $query,
    ) {}

    public function index(ListDecksRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('flashcards.pagination.per_page'));

        $paginator = $this->query->decks($request->user(), $data, $perPage);

        return ApiResponse::success(
            ['decks' => FlashcardDeckResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function store(CreateDeckRequest $request): JsonResponse
    {
        $deck = $this->decks->create($request->user(), $request->validated());

        return ApiResponse::success(['deck' => new FlashcardDeckResource($deck)], null, 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $deck = $this->query->findDeck($request->user(), $id);

        if (! $deck instanceof FlashcardDeck) {
            abort(404);
        }

        return ApiResponse::success(['deck' => new FlashcardDeckResource($deck)]);
    }

    public function update(UpdateDeckRequest $request, string $id): JsonResponse
    {
        $deck = $this->findOrFail($request, $id);

        Gate::forUser($request->user())->authorize('update', $deck);

        $deck = $this->decks->update($deck, $request->validated());

        return ApiResponse::success(['deck' => new FlashcardDeckResource($deck)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $deck = $this->findOrFail($request, $id);

        Gate::forUser($request->user())->authorize('delete', $deck);

        $this->decks->delete($deck);

        return ApiResponse::success(null, null, 204);
    }

    /** کلون دک رسمی → دک شخصی. تنها راه «برداشتن» محتوای رسمی. */
    public function clone(Request $request, string $id): JsonResponse
    {
        $deck = $this->findOrFail($request, $id);

        Gate::forUser($request->user())->authorize('clone', $deck);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:'.(int) config('flashcards.decks.title_max')],
        ]);

        $clone = $this->decks->clone($request->user(), $deck, $data['title'] ?? null);

        return ApiResponse::success(['deck' => new FlashcardDeckResource($clone)], null, 201);
    }

    /**
     * دک را **با scope دسترسی** پیدا می‌کند.
     *
     * اگر شناسه وجود داشته باشد ولی در دسترس کاربر نباشد، همان ۴۰۴ برمی‌گردد —
     * نه ۴۰۳ — تا وجود دک کاربر دیگر لو نرود.
     */
    private function findOrFail(Request $request, string $id): FlashcardDeck
    {
        $deck = $this->query->findDeck($request->user(), $id);

        if (! $deck instanceof FlashcardDeck) {
            abort(404);
        }

        return $deck;
    }
}
