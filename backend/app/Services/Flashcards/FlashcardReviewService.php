<?php

namespace App\Services\Flashcards;

use App\Events\Flashcards\FlashcardReviewed;
use App\Exceptions\ApiErrorException;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Models\FlashcardState;
use App\Models\User;
use App\Services\Flashcards\SpacedRepetition\SpacedRepetitionRegistry;
use App\Services\Flashcards\SpacedRepetition\SpacedRepetitionStrategy;
use App\Services\Support\IdempotencyService;
use App\Support\Idempotency\IdempotencyOutcome;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * مرور — قلب فاز ۹.
 *
 * زنجیره (الزام §18):
 *   Load State → Lock State → Validate ownership → Validate rating →
 *   Resolve Strategy → Calculate Next State → Update State →
 *   Create Immutable Review → Commit
 *
 * مرز اعتماد: کلاینت فقط `rating` و `requestKey` می‌فرستد. `intervalDays`,
 * `ease`, `nextDueAt`, `algorithmVersion` و `userId` نه در rules هستند و نه
 * خوانده می‌شوند (§17 و §46). Controller هیچ الگوریتمی اجرا نمی‌کند (§13).
 */
class FlashcardReviewService
{
    public function __construct(
        private readonly FlashcardAccess $access,
        private readonly FlashcardStateRepository $states,
        private readonly SpacedRepetitionRegistry $strategies,
        private readonly IdempotencyService $idempotency,
    ) {}

    /**
     * ثبت یک مرور.
     *
     * @param  array<string, mixed>  $data
     * @param  Closure(array<string, mixed>):array<string, mixed>  $present
     */
    public function review(User $user, string $cardId, array $data, Closure $present): IdempotencyOutcome
    {
        $card = Flashcard::query()->with('deck')->whereKey($cardId)->first();

        // کارت ناموجود و کارت غیرقابل‌مرور هر دو ۴۰۴ می‌گیرند: وجود/مالکیت لو نمی‌رود.
        if (! $card instanceof Flashcard || ! $this->access->canReviewCard($user, $card)) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Flashcard not found.');
        }

        $rating = (string) $data['rating'];

        if (! in_array($rating, (array) config('flashcards.ratings'), true)) {
            throw new ApiErrorException(
                'RATING_INVALID',
                422,
                'Unknown rating.',
                ['rating' => ['RATING_INVALID']],
            );
        }

        return $this->idempotency->once(
            scope: 'flashcards.review',
            actorKey: 'user:'.$user->getKey(),
            requestKey: $data['requestKey'] ?? null,
            requestPayload: [
                'card_id' => (string) $card->getKey(),
                'rating' => $rating,
            ],
            callback: fn (): IdempotencyOutcome => $this->apply($user, $card, $rating, $present),
        );
    }

    /** @param Closure(array<string, mixed>):array<string, mixed> $present */
    private function apply(User $user, Flashcard $card, string $rating, Closure $present): IdempotencyOutcome
    {
        $now = CarbonImmutable::now();
        $strategy = $this->strategies->default();

        $result = DB::transaction(function () use ($user, $card, $rating, $now, $strategy): array {
            /*
             * کارت ممکن است بین بررسی اولیه و اینجا آرشیو شده باشد. دوباره داخل
             * تراکنش چک می‌شود تا «مرور پس از آرشیو» هرگز رکورد نسازد.
             */
            $card->refresh();

            if (! $card->isReviewable()) {
                throw new ApiErrorException(
                    'CARD_NOT_REVIEWABLE',
                    409,
                    'This card is archived or suspended and cannot be reviewed.',
                );
            }

            $deck = $card->deck;

            if ($deck instanceof FlashcardDeck && $deck->status === FlashcardDeck::STATUS_ARCHIVED) {
                throw new ApiErrorException('DECK_ARCHIVED', 409, 'This deck is archived.');
            }

            $state = $this->states->lockForReview($user, $card);

            $computation = $strategy->schedule($state, $rating, $now);

            /*
             * مقادیر «قبل» **پیش از** نوشتن گرفته می‌شوند. `save()` در لاراول
             * `syncOriginal()` می‌زند؛ اگر بعد از آن `getOriginal()` بخوانیم،
             * مقدار تازه برمی‌گردد و تاریخچه بی‌معنا می‌شود.
             */
            $previousState = (string) ($state->state ?? FlashcardState::STATE_NEW);
            $previousDueAt = $state->due_at;
            $previousInterval = (int) ($state->interval_minutes ?? 0);
            $previousEase = (float) ($state->ease ?? 2.5);

            $state->forceFill([
                'algorithm_version' => $strategy->version(),
                'state' => $computation->state,
                'due_at' => $computation->dueAt,
                'interval_days' => $computation->intervalDays,
                'interval_minutes' => $computation->intervalMinutes,
                'ease' => $computation->ease,
                'review_count' => $computation->reviewCount,
                'lapse_count' => $computation->lapseCount,
                'correct_count' => $computation->correctCount,
                'incorrect_count' => $computation->incorrectCount,
                'learning_step' => $computation->learningStep,
                'difficulty' => $computation->difficulty,
                'stability' => $computation->stability,
                'mastery_score' => $computation->masteryScore,
                // مرور، تعلیق و bury را پاک می‌کند — عیناً مثل `rate()` در JS.
                'suspended' => false,
                'buried_until' => null,
                'last_reviewed_at' => $now,
                'version' => (int) $state->version + 1,
            ])->save();

            $review = new FlashcardReview;
            $review->forceFill([
                'state_id' => $state->getKey(),
                'rating' => $rating,
                'previous_state' => $previousState,
                'new_state' => $computation->state,
                'previous_due_at' => $previousDueAt,
                'next_due_at' => $computation->dueAt,
                'previous_interval_minutes' => $previousInterval,
                'next_interval_minutes' => $computation->intervalMinutes,
                'previous_ease' => $previousEase,
                'next_ease' => $computation->ease,
                'algorithm_version' => $strategy->version(),
                'reviewed_at' => $now,
                'request_key' => null,
                'created_at' => $now,
            ])->save();

            return ['state' => $state, 'review' => $review, 'deck' => $deck];
        });

        /** @var FlashcardState $state */
        $state = $result['state'];
        /** @var FlashcardReview $review */
        $review = $result['review'];

        // رخداد پس از commit — فقط شناسه حمل می‌کند، نه محتوای کارت (§51).
        FlashcardReviewed::dispatch(
            $user->getKey(),
            $card->getKey(),
            $review->getKey(),
            $rating,
            $state->mastery_score,
        );

        $payload = $present([
            'card' => $card,
            'deck' => $result['deck'],
            'state' => $state,
            'review' => $review,
            'preview' => $this->preview($state, $strategy, $now),
        ]);

        return new IdempotencyOutcome(false, 201, $payload);
    }

    /**
     * پیش‌نمایش فاصلهٔ چهار rating — برای دکمه‌های UI.
     *
     * محاسبه روی یک **کپی** انجام می‌شود؛ هیچ چیزی ذخیره نمی‌شود. عدد نهایی
     * همان چیزی است که اگر کاربر همان دکمه را بزند ثبت می‌شود.
     *
     * @return array<string, array{interval_minutes: int, due_at: string}>
     */
    public function preview(FlashcardState $state, ?SpacedRepetitionStrategy $strategy = null, ?CarbonImmutable $now = null): array
    {
        $strategy ??= $this->strategies->default();
        $now ??= CarbonImmutable::now();
        $preview = [];

        foreach ((array) config('flashcards.ratings') as $rating) {
            $computation = $strategy->schedule(clone $state, (string) $rating, $now);

            $preview[(string) $rating] = [
                'interval_minutes' => $computation->intervalMinutes,
                'due_at' => $computation->dueAt->toIso8601String(),
            ];
        }

        return $preview;
    }

    /**
     * صف مرور.
     *
     * دو منبع (نه یک join سنگین):
     *   ۱. وضعیت‌های due کاربر — محدود، با eager load کارت/دک.
     *   ۲. کارت‌های **نو** (بدون ردیف وضعیت) — با `NOT EXISTS`، سقف‌دار.
     *
     * چرا: `due` و `new` دو معنای متفاوت دارند و merge در PHP روی مجموعهٔ
     * **محدودشده** انجام می‌شود؛ پس نه N+1 داریم و نه صف بی‌کران.
     *
     * @param  array<string, mixed>  $filters
     * @return list<array{card: Flashcard, state: ?FlashcardState}>
     */
    public function queue(User $user, array $filters): array
    {
        $now = CarbonImmutable::now();
        $mode = (string) ($filters['mode'] ?? 'today');
        $limit = (int) ($filters['limit'] ?? config('flashcards.review.queue_limit_default'));
        $limit = max(1, min($limit, (int) config('flashcards.review.queue_limit_max')));

        $deckIds = $this->access->visibleDeckIds($user);

        /*
         * اعتبارسنجی `deckId` **پیش از** میان‌بر «کاربر هیچ دکی ندارد» انجام
         * می‌شود. وگرنه همان درخواست برای دک کاربر دیگر، وقتی کاربر خودش هیچ
         * دکی ندارد ۲۰۰ خالی می‌گرفت و وقتی دک دارد ۴۰۴ — یک قرارداد ناهمگون.
         * حالا در هر دو حالت ۴۰۴ است: «این دک برای تو وجود ندارد».
         */
        if (isset($filters['deckId'])) {
            $deckId = (string) $filters['deckId'];

            if (! in_array($deckId, $deckIds, true)) {
                // دک ناموجود و دک غیرمجاز یک پاسخ می‌گیرند.
                throw new ApiErrorException('NOT_FOUND', 404, 'Deck not found.');
            }

            $deckIds = [$deckId];
        }

        if ($deckIds === []) {
            return [];
        }

        $newLimit = min((int) config('flashcards.review.max_new_per_queue'), $limit);

        $due = $mode === 'cram'
            ? collect()
            : $this->dueStates($user, $deckIds, $now, $mode, $limit);

        $new = $mode === 'cram'
            ? collect()
            : $this->newCards($user, $deckIds, $newLimit);

        if ($mode === 'cram') {
            $cram = Flashcard::query()
                ->whereIn('deck_id', $deckIds)
                ->where('status', Flashcard::STATUS_ACTIVE)
                ->with('deck')
                ->orderBy('deck_id')
                ->orderBy('position')
                ->limit($limit)
                ->get();

            return $cram->map(fn (Flashcard $card): array => ['card' => $card, 'state' => null])->all();
        }

        $items = [];

        foreach ($due as $state) {
            if ($state->card instanceof Flashcard) {
                $items[] = ['card' => $state->card, 'state' => $state];
            }
        }

        foreach ($new as $card) {
            $items[] = ['card' => $card, 'state' => null];
        }

        return array_slice($items, 0, $limit);
    }

    /**
     * وضعیت‌های due کاربر در دک‌های مجاز.
     *
     * @param  list<string>  $deckIds
     * @return Collection<int, FlashcardState>
     */
    private function dueStates(User $user, array $deckIds, CarbonImmutable $now, string $mode, int $limit)
    {
        $query = FlashcardState::query()
            ->where('user_id', $user->getKey())
            ->where('suspended', false)
            ->where(function ($builder) use ($now): void {
                $builder->whereNull('buried_until')->orWhere('buried_until', '<=', $now);
            })
            ->where(function ($builder) use ($now): void {
                $builder->whereNull('due_at')->orWhere('due_at', '<=', $now);
            })
            ->whereHas('card', function ($builder) use ($deckIds): void {
                $builder->where('status', Flashcard::STATUS_ACTIVE)->whereIn('deck_id', $deckIds);
            })
            ->with(['card.deck']);

        // `weak` = ضعیف‌ترین‌ها اول؛ بقیه بر اساس زمان سررسید.
        if ($mode === 'weak') {
            $query->orderBy('mastery_score')->orderBy('due_at');
        } else {
            $query->orderBy('due_at');
        }

        return $query->limit($limit)->get();
    }

    /**
     * کارت‌های نو (بدون ردیف وضعیت برای این کاربر).
     *
     * @param  list<string>  $deckIds
     * @return Collection<int, Flashcard>
     */
    private function newCards(User $user, array $deckIds, int $limit)
    {
        return Flashcard::query()
            ->whereIn('deck_id', $deckIds)
            ->where('status', Flashcard::STATUS_ACTIVE)
            ->whereNotExists(function ($sub) use ($user): void {
                $sub->selectRaw('1')
                    ->from('flashcard_states')
                    ->whereColumn('flashcard_states.card_id', 'flashcards.id')
                    ->where('flashcard_states.user_id', $user->getKey());
            })
            ->with('deck')
            ->orderBy('deck_id')
            ->orderBy('position')
            ->limit($limit)
            ->get();
    }

    /**
     * پیشرفت — **مشتق** از `flashcard_states` و `flashcard_reviews`.
     *
     * هیچ ستون شمارشی ذخیره نمی‌شود؛ همه از دادهٔ موجود محاسبه می‌شوند تا
     * «وضعیت» و «آمار» هرگز واگرا نشوند (§20).
     *
     * @return array<string, int>
     */
    public function progress(User $user): array
    {
        $deckIds = $this->access->visibleDeckIds($user);

        if ($deckIds === []) {
            return ['total' => 0, 'new' => 0, 'learning' => 0, 'due' => 0, 'reviewed_today' => 0, 'mastered' => 0, 'suspended' => 0];
        }

        $total = Flashcard::query()
            ->whereIn('deck_id', $deckIds)
            ->where('status', Flashcard::STATUS_ACTIVE)
            ->count();

        $now = CarbonImmutable::now();
        $masteryScore = (int) config('flashcards.review.mastery_score', 85);
        $masteryInterval = (int) config('flashcards.review.mastery_interval_days', 21);

        /*
         * همهٔ شمارش‌ها در SQL می‌ماند — این عبارت‌ها **آینهٔ دقیق**
         * `FlashcardState::isDue()`اند؛ اگر مدل عوض شود اینجا هم باید عوض شود.
         * پیش‌تر ۲٬۴۰۰ مدل Eloquent هیدرات و در PHP شمرده می‌شد که روی PG واقعی
         * (۱۲۰k وضعیت، ۲٬۴۰۰ ردیف برای کاربر) ~۱۶۰ms می‌گرفت؛ اکنون یک ردیف
         * تجمیعی برمی‌گردد (~۱ms).
         */
        $aggregate = FlashcardState::query()
            ->selectRaw('count(*) as states_total')
            ->selectRaw('sum(case when state in (?, ?) then 1 else 0 end) as learning', [
                FlashcardState::STATE_LEARNING,
                FlashcardState::STATE_RELEARNING,
            ])
            ->selectRaw('sum(case when suspended then 1 else 0 end) as suspended')
            ->selectRaw(<<<'SQL'
                sum(case when suspended = false
                          and (buried_until is null or buried_until > ?)
                          and (state = ? or due_at is null or due_at <= ?)
                     then 1 else 0 end) as due
                SQL, [$now, FlashcardState::STATE_NEW, $now])
            ->selectRaw('sum(case when mastery_score >= ? and interval_days >= ? then 1 else 0 end) as mastered', [
                $masteryScore,
                $masteryInterval,
            ])
            ->where('user_id', $user->getKey())
            ->whereHas('card', fn ($builder) => $builder->where('status', Flashcard::STATUS_ACTIVE)->whereIn('deck_id', $deckIds))
            ->first();

        $reviewedToday = FlashcardReview::query()
            ->join('flashcard_states', 'flashcard_states.id', '=', 'flashcard_reviews.state_id')
            ->where('flashcard_states.user_id', $user->getKey())
            ->where('flashcard_reviews.reviewed_at', '>=', $now->startOfDay())
            ->count();

        $statesTotal = (int) ($aggregate->states_total ?? 0);

        return [
            'total' => $total,
            'new' => max(0, $total - $statesTotal),
            'learning' => (int) ($aggregate->learning ?? 0),
            'due' => (int) ($aggregate->due ?? 0),
            'reviewed_today' => $reviewedToday,
            'mastered' => (int) ($aggregate->mastered ?? 0),
            'suspended' => (int) ($aggregate->suspended ?? 0),
        ];
    }
}
