<?php

namespace App\Services\Flashcards;

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardState;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * خواندن دک/کارت — بدون هیچ نویسندگی.
 *
 * همهٔ کوئری‌ها از `FlashcardAccess` عبور می‌کنند: یک کاربر هرگز کارت کاربر
 * دیگر را نمی‌بیند، حتی اگر شناسه را حدس بزند. `deckId` از ورودی **فقط** برای
 * محدودکردن، نه برای دسترسی.
 */
class FlashcardQueryService
{
    public function __construct(private readonly FlashcardAccess $access) {}

    /**
     * دک‌های کاربر: شخصی‌ها + رسمی‌های منتشرشده.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, FlashcardDeck>
     */
    public function decks(User $user, array $filters, int $perPage): LengthAwarePaginator
    {
        $query = $this->access->visibleDecks($user);

        if (isset($filters['owner']) && $filters['owner'] === 'me') {
            $query->where('owner_user_id', $user->getKey());
        }

        if (isset($filters['owner']) && $filters['owner'] === 'official') {
            $query->whereNull('owner_user_id');
        }

        if (isset($filters['q'])) {
            $needle = $this->like((string) $filters['q']);
            $query->where(function (Builder $inner) use ($needle): void {
                $inner->where('title', 'like', $needle)
                    ->orWhere('description', 'like', $needle);
            });
        }

        return $query
            ->withCount(['cards as cards_count' => fn (Builder $cards) => $cards->where('status', Flashcard::STATUS_ACTIVE)])
            ->orderByDesc('owner_user_id')
            ->orderByDesc('updated_at')
            ->paginate($perPage);
    }

    public function findDeck(User $user, string $deckId): ?FlashcardDeck
    {
        return $this->access->visibleDecks($user)
            ->whereKey($deckId)
            ->withCount(['cards as cards_count' => fn (Builder $cards) => $cards->where('status', Flashcard::STATUS_ACTIVE)])
            ->first();
    }

    /**
     * کارت‌های یک دک قابل‌خواندن.
     *
     * @return LengthAwarePaginator<int, Flashcard>
     */
    public function cards(FlashcardDeck $deck, int $perPage): LengthAwarePaginator
    {
        return Flashcard::query()
            ->where('deck_id', $deck->getKey())
            ->orderBy('position')
            ->paginate($perPage);
    }

    public function findCard(User $user, string $cardId): ?Flashcard
    {
        return Flashcard::query()
            ->whereKey($cardId)
            ->whereIn('deck_id', $this->access->visibleDeckIds($user))
            ->with('deck')
            ->first();
    }

    /**
     * جست‌وجو/فیلتر کارت‌ها در دک‌های مجاز — برای بخش جست‌وجوی UI.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Flashcard>
     */
    public function searchCards(User $user, array $filters, int $perPage): LengthAwarePaginator
    {
        $deckIds = $this->access->visibleDeckIds($user);

        if (isset($filters['deckId'])) {
            $deckId = (string) $filters['deckId'];
            $deckIds = in_array($deckId, $deckIds, true) ? [$deckId] : [];
        }

        $query = Flashcard::query()
            ->whereIn('deck_id', $deckIds)
            ->with('deck');

        if (isset($filters['q'])) {
            $needle = $this->like((string) $filters['q']);
            $query->where(function (Builder $inner) use ($needle): void {
                $inner->where('front', 'like', $needle)->orWhere('back', 'like', $needle);
            });
        }

        if (isset($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        // فیلترهای وضعیت کاربر با یک subquery — بدون join و بدون N+1.
        if (isset($filters['state']) || array_key_exists('bookmarked', $filters)) {
            $query->whereIn('id', function ($sub) use ($user, $filters): void {
                $sub->select('card_id')->from('flashcard_states')->where('user_id', $user->getKey());

                if (isset($filters['state'])) {
                    $sub->where('state', (string) $filters['state']);
                }

                if (array_key_exists('bookmarked', $filters)) {
                    $sub->where('bookmarked', (bool) $filters['bookmarked']);
                }
            });
        }

        return $query->orderBy('deck_id')->orderBy('position')->paginate($perPage);
    }

    /**
     * فهرست دک‌ها در پنل — **همهٔ** دک‌ها، بدون scope کاربر.
     *
     * جدا از `decks()` نوشته شده چون مرز مجوز متفاوت است: اینجا مجوز
     * `flashcards.read` تصمیم می‌گیرد، نه مالکیت. قاطی‌کردن این دو در یک متد
     * یعنی روزی یک فیلتر اشتباه، دک خصوصی کاربر را در پنل عمومی نشان می‌دهد.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, FlashcardDeck>
     */
    public function adminDecks(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = FlashcardDeck::query();

        if (($filters['owner'] ?? null) === 'official') {
            $query->whereNull('owner_user_id');
        }

        if (($filters['owner'] ?? null) === 'personal') {
            $query->whereNotNull('owner_user_id');
        }

        if (isset($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        if (isset($filters['q'])) {
            $needle = $this->like((string) $filters['q']);
            $query->where(function (Builder $inner) use ($needle): void {
                $inner->where('title', 'like', $needle)->orWhere('description', 'like', $needle);
            });
        }

        return $query
            ->withCount(['cards as cards_count' => fn (Builder $cards) => $cards->where('status', Flashcard::STATUS_ACTIVE)])
            ->orderByDesc('updated_at')
            ->paginate($perPage);
    }

    public function adminFindDeck(string $deckId): ?FlashcardDeck
    {
        return FlashcardDeck::query()
            ->whereKey($deckId)
            ->withCount(['cards as cards_count' => fn (Builder $cards) => $cards->where('status', Flashcard::STATUS_ACTIVE)])
            ->first();
    }

    /**
     * کارت‌های یک دک — نسخهٔ پنل (بدون scope کاربر).
     *
     * @return LengthAwarePaginator<int, Flashcard>
     */
    public function adminCards(FlashcardDeck $deck, int $perPage): LengthAwarePaginator
    {
        return Flashcard::query()
            ->where('deck_id', $deck->getKey())
            ->orderBy('position')
            ->paginate($perPage);
    }

    public function adminFindCard(string $cardId): ?Flashcard
    {
        return Flashcard::query()->whereKey($cardId)->with('deck')->first();
    }

    /**
     * وضعیت کاربر برای مجموعه‌ای از کارت‌ها — برای غنی‌کردن خروجی.
     *
     * @param  list<string>  $cardIds
     * @return array<string, FlashcardState>
     */
    public function statesFor(User $user, array $cardIds): array
    {
        if ($cardIds === []) {
            return [];
        }

        return FlashcardState::query()
            ->where('user_id', $user->getKey())
            ->whereIn('card_id', $cardIds)
            ->get()
            ->keyBy(fn (FlashcardState $state): string => (string) $state->card_id)
            ->all();
    }

    /** الگوی LIKE امن — `%` و `_` کاربر نباید wildcard شوند. */
    private function like(string $needle): string
    {
        return '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $needle).'%';
    }
}
