<?php

namespace App\Services\Flashcards;

use App\Exceptions\ApiErrorException;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Models\FlashcardState;
use App\Models\User;
use App\Support\Content\RichTextSanitizer;
use Illuminate\Support\Facades\DB;

/**
 * محتوای کارت + اکشن‌های سطح وضعیت (suspend / bury / bookmark).
 *
 * جدایی مهم: **تعریف کارت** اینجا نوشته می‌شود، ولی **وضعیت یادگیری** فقط از
 * طریق `FlashcardStateRepository` و محاسبهٔ الگوریتم تغییر می‌کند. هیچ اکشن
 * این سرویس `due_at` یا `ease` را دست نمی‌زند.
 *
 * محتوای `front`/`back` پیش از ذخیره از فیلتر whitelist عبور می‌کند (پروفایل
 * `inline`). بنابراین payload خطرناک هرگز در دیتابیس نمی‌نشیند — نه فقط هنگام
 * نمایش پاک می‌شود.
 */
class FlashcardService
{
    public function __construct(
        private readonly RichTextSanitizer $sanitizer,
        private readonly FlashcardStateRepository $states,
    ) {}

    /** @param array<string, mixed> $data */
    public function createCard(FlashcardDeck $deck, array $data): Flashcard
    {
        $this->assertCapacity($deck, 1);

        $card = new Flashcard;
        $card->forceFill([
            'deck_id' => $deck->getKey(),
            'front' => $this->content($data['front'] ?? null, 'front'),
            'back' => $this->content($data['back'] ?? null, 'back'),
            'position' => $this->nextPosition($deck),
            'status' => Flashcard::STATUS_ACTIVE,
        ])->save();

        return $card;
    }

    /**
     * ساخت دسته‌ای — برای import از متن Anki‌مانند.
     *
     * کل دسته در **یک تراکنش** ساخته می‌شود: یا همه وارد می‌شوند یا هیچ‌کدام.
     *
     * @param  list<array<string, mixed>>  $cards
     * @return list<Flashcard>
     */
    public function createCards(FlashcardDeck $deck, array $cards): array
    {
        $this->assertCapacity($deck, count($cards));

        return DB::transaction(function () use ($deck, $cards): array {
            $created = [];
            $position = $this->nextPosition($deck);

            foreach ($cards as $row) {
                $card = new Flashcard;
                $card->forceFill([
                    'deck_id' => $deck->getKey(),
                    'front' => $this->content($row['front'] ?? null, 'front'),
                    'back' => $this->content($row['back'] ?? null, 'back'),
                    'position' => $position,
                    'status' => Flashcard::STATUS_ACTIVE,
                ])->save();

                $created[] = $card;
                $position++;
            }

            return $created;
        });
    }

    /** @param array<string, mixed> $data */
    public function updateCard(Flashcard $card, array $data): Flashcard
    {
        $attributes = [];

        if (array_key_exists('front', $data)) {
            $attributes['front'] = $this->content($data['front'], 'front');
        }

        if (array_key_exists('back', $data)) {
            $attributes['back'] = $this->content($data['back'], 'back');
        }

        if (array_key_exists('status', $data)) {
            $status = (string) $data['status'];

            if (! in_array($status, (array) config('flashcards.cards.statuses'), true)) {
                throw new ApiErrorException('CARD_STATUS_INVALID', 422, 'Unknown card status.', ['status' => ['CARD_STATUS_INVALID']]);
            }

            $attributes['status'] = $status;
        }

        if ($attributes === []) {
            return $card;
        }

        $card->forceFill($attributes)->save();

        return $card;
    }

    /**
     * حذف کارت.
     *
     * اگر هیچ وضعیت/مروری برای کارت وجود نداشته باشد، حذف فیزیکی انجام می‌شود
     * (کارت هرگز مرور نشده ⇒ چیزی برای از دست دادن نیست). در غیر این صورت کارت
     * **آرشیو** می‌شود تا تاریخچهٔ immutable سالم بماند.
     *
     * @return 'deleted'|'archived'
     */
    public function deleteCard(Flashcard $card): string
    {
        $hasHistory = FlashcardState::query()->where('card_id', $card->getKey())->exists();

        if ($hasHistory) {
            $card->forceFill(['status' => Flashcard::STATUS_ARCHIVED])->save();

            return 'archived';
        }

        $card->delete();

        return 'deleted';
    }

    /** معلق‌کردن/آزادکردن کارت برای یک کاربر. */
    public function setSuspended(User $user, Flashcard $card, bool $suspended): FlashcardState
    {
        $state = $this->states->getOrCreate($user, $card);
        $state->forceFill([
            'suspended' => $suspended,
            'version' => (int) $state->version + 1,
        ])->save();

        return $state;
    }

    /** «بی‌صدا کردن موقت» — کارت تا N روز از صف مرور خارج می‌شود. */
    public function bury(User $user, Flashcard $card, ?int $days = null): FlashcardState
    {
        $days ??= (int) config('flashcards.review.default_bury_days', 1);
        $days = max(1, min($days, (int) config('flashcards.review.max_bury_days', 30)));

        $state = $this->states->getOrCreate($user, $card);
        $state->forceFill([
            'buried_until' => now()->addDays($days),
            'version' => (int) $state->version + 1,
        ])->save();

        return $state;
    }

    public function setBookmarked(User $user, Flashcard $card, bool $bookmarked): FlashcardState
    {
        $state = $this->states->getOrCreate($user, $card);
        $state->forceFill([
            'bookmarked' => $bookmarked,
            'version' => (int) $state->version + 1,
        ])->save();

        return $state;
    }

    /**
     * مرورهای یک کاربر برای چند کارت — یک کوئری، بدون N+1.
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

    /**
     * مرورهای امروز کاربر برای مجموعه‌ای از کارت‌ها.
     *
     * @param  list<string>  $cardIds
     * @return array<string, int>
     */
    public function reviewsTodayByCard(User $user, array $cardIds): array
    {
        if ($cardIds === []) {
            return [];
        }

        return FlashcardReview::query()
            ->join('flashcard_states', 'flashcard_states.id', '=', 'flashcard_reviews.state_id')
            ->where('flashcard_states.user_id', $user->getKey())
            ->whereIn('flashcard_states.card_id', $cardIds)
            ->where('flashcard_reviews.reviewed_at', '>=', now()->startOfDay())
            ->groupBy('flashcard_states.card_id')
            ->selectRaw('flashcard_states.card_id as card_id, count(*) as total')
            ->pluck('total', 'card_id')
            ->map(fn ($value): int => (int) $value)
            ->all();
    }

    private function nextPosition(FlashcardDeck $deck): int
    {
        $max = Flashcard::query()->where('deck_id', $deck->getKey())->max('position');

        return ((int) $max) + 1;
    }

    private function assertCapacity(FlashcardDeck $deck, int $incoming): void
    {
        $max = (int) config('flashcards.decks.max_cards_per_deck', 2000);
        $current = Flashcard::query()->where('deck_id', $deck->getKey())->count();

        if ($current + $incoming > $max) {
            throw new ApiErrorException(
                'DECK_CARD_LIMIT_REACHED',
                409,
                'This deck has reached the maximum number of cards.',
            );
        }
    }

    private function content(mixed $value, string $field): string
    {
        $raw = is_string($value) ? $value : '';

        if (trim($raw) === '') {
            throw new ApiErrorException(
                'CARD_CONTENT_REQUIRED',
                422,
                'Card content cannot be empty.',
                [$field => ['CARD_CONTENT_REQUIRED']],
            );
        }

        if (! (bool) config('flashcards.sanitize.enabled', true)) {
            return $raw;
        }

        return $this->sanitizer->sanitize($raw, 'inline') ?? '';
    }
}
