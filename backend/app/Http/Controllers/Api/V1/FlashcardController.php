<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Flashcards\CardStateActionRequest;
use App\Http\Requests\Flashcards\CreateFlashcardRequest;
use App\Http\Requests\Flashcards\ListCardsRequest;
use App\Http\Requests\Flashcards\ListDeckCardsRequest;
use App\Http\Requests\Flashcards\UpdateFlashcardRequest;
use App\Http\Resources\FlashcardResource;
use App\Http\Resources\FlashcardStateResource;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Services\Flashcards\FlashcardQueryService;
use App\Services\Flashcards\FlashcardService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * کارت‌های فلش‌کارت — فاز ۹.
 *
 *   GET    /api/v1/flashcards/cards                     جست‌وجو/فیلتر کارت‌ها
 *   GET    /api/v1/flashcards/decks/{id}/cards          کارت‌های یک دک
 *   POST   /api/v1/flashcards/decks/{id}/cards          ساخت کارت (تک/دسته‌ای)
 *   PATCH  /api/v1/flashcards/cards/{id}                ویرایش کارت
 *   DELETE /api/v1/flashcards/cards/{id}                حذف/آرشیو کارت
 *   POST   /api/v1/flashcards/cards/{id}/suspend        معلق/آزاد
 *   POST   /api/v1/flashcards/cards/{id}/bury           بی‌صدا کردن موقت
 *   POST   /api/v1/flashcards/cards/{id}/bookmark       نشان‌گذاری
 *
 * نوشتن فقط روی کارت‌های دک شخصی خودِ کاربر؛ مرور روی کارت‌های دک رسمی هم مجاز
 * است (وضعیت یادگیری همیشه مال کاربر است).
 */
class FlashcardController extends Controller
{
    public function __construct(
        private readonly FlashcardService $cards,
        private readonly FlashcardQueryService $query,
    ) {}

    public function index(ListCardsRequest $request): JsonResponse
    {
        $filters = $request->filters();
        $perPage = (int) ($filters['perPage'] ?? config('flashcards.pagination.per_page'));

        $paginator = $this->query->searchCards($request->user(), $filters, $perPage);
        $states = $this->query->statesFor($request->user(), $paginator->pluck('id')->all());

        $items = [];

        foreach ($paginator->items() as $card) {
            $items[] = $this->present($card, $states[(string) $card->getKey()] ?? null, $request);
        }

        return ApiResponse::success(['cards' => $items], Pagination::meta($paginator));
    }

    public function indexByDeck(ListDeckCardsRequest $request, string $deckId): JsonResponse
    {
        $deck = $this->findDeck($request, $deckId);
        $perPage = (int) ($request->validated()['perPage'] ?? config('flashcards.pagination.per_page'));

        $paginator = $this->query->cards($deck, $perPage);
        $states = $this->query->statesFor($request->user(), $paginator->pluck('id')->all());

        $items = [];

        foreach ($paginator->items() as $card) {
            $items[] = $this->present($card, $states[(string) $card->getKey()] ?? null, $request);
        }

        return ApiResponse::success(
            ['deck' => ['id' => $deck->getKey(), 'title' => $deck->title], 'cards' => $items],
            Pagination::meta($paginator),
        );
    }

    public function store(CreateFlashcardRequest $request, string $deckId): JsonResponse
    {
        $deck = $this->findDeck($request, $deckId);

        Gate::forUser($request->user())->authorize('update', $deck);

        if ($request->isBatch()) {
            $created = $this->cards->createCards($deck, $request->batch());

            return ApiResponse::success(
                ['cards' => FlashcardResource::collection($created)],
                ['created' => count($created)],
                201,
            );
        }

        $data = $request->validated();
        $card = $this->cards->createCard($deck, $data);

        return ApiResponse::success(['card' => new FlashcardResource($card)], null, 201);
    }

    public function update(UpdateFlashcardRequest $request, string $id): JsonResponse
    {
        $card = $this->findCard($request, $id);

        Gate::forUser($request->user())->authorize('update', $card);

        $card = $this->cards->updateCard($card, $request->validated());

        return ApiResponse::success(['card' => new FlashcardResource($card)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $card = $this->findCard($request, $id);

        Gate::forUser($request->user())->authorize('delete', $card);

        $outcome = $this->cards->deleteCard($card);

        return ApiResponse::success(['outcome' => $outcome]);
    }

    public function suspend(CardStateActionRequest $request, string $id): JsonResponse
    {
        $card = $this->findReviewableCard($request, $id);
        $suspended = (bool) ($request->validated()['suspended'] ?? true);

        $state = $this->cards->setSuspended($request->user(), $card, $suspended);

        return ApiResponse::success(['state' => new FlashcardStateResource($state)]);
    }

    public function bury(CardStateActionRequest $request, string $id): JsonResponse
    {
        $card = $this->findReviewableCard($request, $id);
        $days = $request->validated()['days'] ?? null;

        $state = $this->cards->bury($request->user(), $card, $days === null ? null : (int) $days);

        return ApiResponse::success(['state' => new FlashcardStateResource($state)]);
    }

    public function bookmark(CardStateActionRequest $request, string $id): JsonResponse
    {
        $card = $this->findReviewableCard($request, $id);
        $bookmarked = (bool) ($request->validated()['bookmarked'] ?? true);

        $state = $this->cards->setBookmarked($request->user(), $card, $bookmarked);

        return ApiResponse::success(['state' => new FlashcardStateResource($state)]);
    }

    /** @return array<string, mixed> */
    private function present(Flashcard $card, mixed $state, Request $request): array
    {
        return [
            'card' => (new FlashcardResource($card))->resolve($request),
            'state' => $state === null ? null : (new FlashcardStateResource($state))->resolve($request),
        ];
    }

    private function findDeck(Request $request, string $deckId): FlashcardDeck
    {
        $deck = $this->query->findDeck($request->user(), $deckId);

        if (! $deck instanceof FlashcardDeck) {
            abort(404);
        }

        return $deck;
    }

    private function findCard(Request $request, string $id): Flashcard
    {
        $card = $this->query->findCard($request->user(), $id);

        if (! $card instanceof Flashcard) {
            abort(404);
        }

        return $card;
    }

    /** اکشن‌های وضعیت روی کارت **مجاز برای مرور** (شخصی یا رسمیِ منتشرشده). */
    private function findReviewableCard(Request $request, string $id): Flashcard
    {
        $card = $this->findCard($request, $id);

        Gate::forUser($request->user())->authorize('review', $card);

        return $card;
    }
}
