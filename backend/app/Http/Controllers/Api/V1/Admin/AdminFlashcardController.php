<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiErrorException;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\Flashcards\Admin\AdminListDecksRequest;
use App\Http\Requests\Flashcards\Admin\AdminStoreDeckRequest;
use App\Http\Requests\Flashcards\Admin\AdminUpdateDeckRequest;
use App\Http\Requests\Flashcards\CreateFlashcardRequest;
use App\Http\Requests\Flashcards\UpdateFlashcardRequest;
use App\Http\Resources\FlashcardDeckResource;
use App\Http\Resources\FlashcardResource;
use App\Models\Admin;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Services\Flashcards\FlashcardDeckService;
use App\Services\Flashcards\FlashcardQueryService;
use App\Services\Flashcards\FlashcardService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * دک/کارت رسمی در پنل — فاز ۹.
 *
 * مجوزها با **کلیدهای واقعی پنل** چک می‌شوند (`flashcards.*` از
 * `AdminRbacSeeder`)، نه کلید اختراعی. مسیرها زیر `api.can` هستند.
 *
 *   GET    /api/v1/admin/flashcards/decks                flashcards.read
 *   GET    /api/v1/admin/flashcards/decks/{id}           flashcards.read
 *   POST   /api/v1/admin/flashcards/decks                flashcards.create
 *   PATCH  /api/v1/admin/flashcards/decks/{id}           flashcards.update
 *   DELETE /api/v1/admin/flashcards/decks/{id}           flashcards.delete
 *   POST   /api/v1/admin/flashcards/decks/{id}/publish   flashcards.publish
 *   POST   /api/v1/admin/flashcards/decks/{id}/archive   flashcards.publish
 *   GET    /api/v1/admin/flashcards/decks/{id}/cards     flashcards.read
 *   POST   /api/v1/admin/flashcards/decks/{id}/cards     flashcards.create
 *   PATCH  /api/v1/admin/flashcards/cards/{id}           flashcards.update
 *   DELETE /api/v1/admin/flashcards/cards/{id}           flashcards.delete
 *
 * `owner_user_id` در همهٔ این مسیرها `null` می‌ماند: پنل دک رسمی می‌سازد.
 */
class AdminFlashcardController extends Controller
{
    public function __construct(
        private readonly FlashcardDeckService $decks,
        private readonly FlashcardService $cards,
        private readonly FlashcardQueryService $query,
    ) {}

    public function index(AdminListDecksRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('flashcards.pagination.per_page'));

        $paginator = $this->query->adminDecks($data, $perPage);

        return ApiResponse::success(
            ['decks' => FlashcardDeckResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function show(string $id): JsonResponse
    {
        return ApiResponse::success([
            'deck' => new FlashcardDeckResource($this->deckOrFail($id)),
        ]);
    }

    public function store(AdminStoreDeckRequest $request): JsonResponse
    {
        $deck = $this->decks->adminCreate($this->admin($request), $request->validated());

        return ApiResponse::success(['deck' => new FlashcardDeckResource($deck)], null, 201);
    }

    public function update(AdminUpdateDeckRequest $request, string $id): JsonResponse
    {
        $deck = $this->decks->adminUpdate($this->deckOrFail($id), $request->validated());

        return ApiResponse::success(['deck' => new FlashcardDeckResource($deck)]);
    }

    public function destroy(string $id): JsonResponse
    {
        $this->decks->delete($this->deckOrFail($id));

        return ApiResponse::success(null, null, 204);
    }

    public function publish(string $id): JsonResponse
    {
        $deck = $this->decks->publish($this->deckOrFail($id));

        return ApiResponse::success(['deck' => new FlashcardDeckResource($deck)]);
    }

    public function archive(string $id): JsonResponse
    {
        $deck = $this->decks->archive($this->deckOrFail($id));

        return ApiResponse::success(['deck' => new FlashcardDeckResource($deck)]);
    }

    public function cards(Request $request, string $id): JsonResponse
    {
        $deck = $this->deckOrFail($id);
        $perPage = (int) $request->integer('perPage', (int) config('flashcards.pagination.per_page'));

        $paginator = $this->query->adminCards($deck, max(1, min($perPage, (int) config('flashcards.pagination.max_per_page'))));

        return ApiResponse::success(
            ['cards' => FlashcardResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function storeCard(CreateFlashcardRequest $request, string $id): JsonResponse
    {
        $deck = $this->deckOrFail($id);

        if ($deck->status === FlashcardDeck::STATUS_ARCHIVED) {
            throw new ApiErrorException('DECK_ARCHIVED', 409, 'Cannot add cards to an archived deck.');
        }

        if ($request->isBatch()) {
            $created = $this->cards->createCards($deck, $request->batch());

            return ApiResponse::success(['cards' => FlashcardResource::collection($created)], ['created' => count($created)], 201);
        }

        $card = $this->cards->createCard($deck, $request->validated());

        return ApiResponse::success(['card' => new FlashcardResource($card)], null, 201);
    }

    public function updateCard(UpdateFlashcardRequest $request, string $id): JsonResponse
    {
        $card = $this->cardOrFail($id);

        return ApiResponse::success(['card' => new FlashcardResource($this->cards->updateCard($card, $request->validated()))]);
    }

    public function destroyCard(string $id): JsonResponse
    {
        $outcome = $this->cards->deleteCard($this->cardOrFail($id));

        return ApiResponse::success(['outcome' => $outcome]);
    }

    private function deckOrFail(string $id): FlashcardDeck
    {
        $deck = $this->query->adminFindDeck($id);

        if (! $deck instanceof FlashcardDeck) {
            abort(404);
        }

        return $deck;
    }

    private function cardOrFail(string $id): Flashcard
    {
        $card = $this->query->adminFindCard($id);

        if (! $card instanceof Flashcard) {
            abort(404);
        }

        return $card;
    }

    /** `author_admin_id` از سشن ادمین می‌آید، نه از بدنه. */
    private function admin(Request $request): Admin
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            throw ApiErrorException::unauthenticated();
        }

        return $admin;
    }
}
