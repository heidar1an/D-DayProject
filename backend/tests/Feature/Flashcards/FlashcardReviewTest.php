<?php

namespace Tests\Feature\Flashcards;

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Models\FlashcardState;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsFlashcards;
use Tests\TestCase;

/**
 * مرور فلش‌کارت — قلب فاز ۹.
 *
 * این فایل چهار چیز را قفل می‌کند:
 *   ۱. **مرز اعتماد**: کلاینت فقط `rating` می‌فرستد؛ `interval`/`ease`/
 *      `nextDueAt`/`algorithmVersion` هرگز خوانده نمی‌شوند.
 *   ۲. **Idempotency**: همان کلید + همان payload ⇒ همان پاسخ (بدون مرور دوم)؛
 *      همان کلید + payload متفاوت ⇒ ۴۰۹.
 *   ۳. **تاریخچه immutable**: `flashcard_reviews` ستون `updated_at` ندارد و
 *      فقط از سرویس مرور نوشته می‌شود.
 *   ۴. **مشتق‌بودن پیشرفت**: هیچ ستون شمارشی ذخیره نمی‌شود.
 */
class FlashcardReviewTest extends TestCase
{
    use BuildsFlashcards, RefreshDatabase;

    private function reviewUri(string $cardId): string
    {
        return '/api/v1/flashcards/review/'.$cardId;
    }

    // ── ثبت مرور ────────────────────────────────────────────────────────

    public function test_a_review_creates_the_state_and_an_immutable_review_row(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $response = $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        $this->assertSame('sm2-tapesh-v1', $response->json('data.review.state.algorithm_version'));
        $this->assertSame(FlashcardState::STATE_LEARNING, $response->json('data.review.state.state'));
        $this->assertSame($card->getKey(), $response->json('data.review.card_id'));

        /* پیش‌نمایش هر چهار rating از سرور می‌آید تا UI الگوریتم را تکرار نکند. */
        $this->assertSame(
            ['again', 'hard', 'good', 'easy'],
            array_keys($response->json('data.review.preview')),
        );

        $state = FlashcardState::query()->sole();
        $this->assertSame($student['user']->getKey(), $state->user_id);
        $this->assertSame(1, (int) $state->review_count);
        $this->assertNotNull($state->last_reviewed_at);

        $review = FlashcardReview::query()->sole();
        $this->assertSame('good', $review->rating);
        $this->assertSame('sm2-tapesh-v1', $review->algorithm_version);
        $this->assertNull($review->request_key);
    }

    public function test_the_review_history_table_is_append_only(): void
    {
        /* immutable بودن تاریخچه در سطح schema قفل شده: بدون `updated_at`. */
        $this->assertFalse(Schema::hasColumn('flashcard_reviews', 'updated_at'));
        $this->assertTrue(Schema::hasColumn('flashcard_reviews', 'created_at'));

        /*
         * و هیچ مسیر HTTP برای تغییر/حذف تاریخچه وجود ندارد — تاریخچه فقط
         * نوشتنی است، آن هم از `FlashcardReviewService`.
         */
        $uris = array_map(
            static fn ($route): string => (string) $route->uri(),
            app('router')->getRoutes()->getRoutes(),
        );

        foreach ($uris as $uri) {
            $this->assertStringNotContainsString('flashcards/reviews', $uri);
            $this->assertStringNotContainsString('flashcards/review-history', $uri);
        }
    }

    public function test_the_client_cannot_inject_the_scheduling_values(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $clean = $this->makeCard($deck);
        $poisoned = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($clean->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        /*
         * همان درخواست، این بار با هر فیلدی که یک مهاجم ممکن است بفرستد.
         * هیچ‌کدام در `rules` نیست، پس نه خوانده می‌شود و نه ذخیره.
         */
        $this->postJsonWithOrigin($this->reviewUri($poisoned->getKey()), [
            'rating' => 'good',
            'intervalDays' => 999,
            'interval' => 999,
            'ease' => 4.9,
            'nextDueAt' => '2030-01-01T00:00:00+00:00',
            'dueAt' => '2030-01-01T00:00:00+00:00',
            'algorithmVersion' => 'evil-v9',
            'state' => 'mastered',
            'masteryScore' => 100,
            'userId' => '00000000-0000-0000-0000-000000000000',
        ], $student['csrf'])->assertStatus(201);

        $cleanState = FlashcardState::query()->where('card_id', $clean->getKey())->sole();
        $poisonedState = FlashcardState::query()->where('card_id', $poisoned->getKey())->sole();

        $this->assertSame($cleanState->interval_minutes, $poisonedState->interval_minutes);
        $this->assertSame((float) $cleanState->ease, (float) $poisonedState->ease);
        $this->assertSame($cleanState->due_at?->toIso8601String(), $poisonedState->due_at?->toIso8601String());
        $this->assertSame('sm2-tapesh-v1', $poisonedState->algorithm_version);
        $this->assertSame(FlashcardState::STATE_LEARNING, $poisonedState->state);
        $this->assertLessThan(100, (int) $poisonedState->mastery_score);
    }

    public function test_an_unknown_rating_is_rejected(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'perfect',
        ], $student['csrf'])
            ->assertStatus(422)
            ->assertFieldError('rating');

        $this->assertSame(0, FlashcardState::query()->count());
        $this->assertSame(0, FlashcardReview::query()->count());
    }

    public function test_a_missing_rating_is_rejected(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [], $student['csrf'])
            ->assertStatus(422)
            ->assertFieldError('rating');
    }

    public function test_a_guest_cannot_review(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $csrf = $student['csrf'];
        $this->forgetCookies();

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), ['rating' => 'good'], $csrf)
            ->assertStatus(401);

        $this->assertSame(0, FlashcardReview::query()->count());
    }

    // ── Idempotency ─────────────────────────────────────────────────────

    public function test_replaying_the_same_request_key_returns_the_same_review_without_a_second_row(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $payload = ['rating' => 'good', 'requestKey' => 'key-abc-123'];

        $first = $this->postJsonWithOrigin($this->reviewUri($card->getKey()), $payload, $student['csrf'])
            ->assertStatus(201);

        $second = $this->postJsonWithOrigin($this->reviewUri($card->getKey()), $payload, $student['csrf'])
            ->assertStatus(201);

        $this->assertSame($first->json('data.review.review.id'), $second->json('data.review.review.id'));
        $this->assertSame($first->json('data.review.state.due_at'), $second->json('data.review.state.due_at'));

        /* حیاتی: مرور دوباره اجرا نشده ⇒ یک ردیف تاریخچه، نه دو. */
        $this->assertSame(1, FlashcardReview::query()->count());
        $this->assertSame(1, (int) FlashcardState::query()->sole()->review_count);
    }

    public function test_reusing_a_request_key_with_a_different_payload_is_a_409(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
            'requestKey' => 'key-reuse-1',
        ], $student['csrf'])->assertStatus(201);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'again',
            'requestKey' => 'key-reuse-1',
        ], $student['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'IDEMPOTENCY_KEY_REUSED');

        $this->assertSame(1, FlashcardReview::query()->count());
        $this->assertSame('good', FlashcardReview::query()->sole()->rating);
    }

    public function test_the_same_request_key_for_a_different_card_is_a_409(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $first = $this->makeCard($deck);
        $second = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($first->getKey()), [
            'rating' => 'good',
            'requestKey' => 'key-cross-card',
        ], $student['csrf'])->assertStatus(201);

        $this->postJsonWithOrigin($this->reviewUri($second->getKey()), [
            'rating' => 'good',
            'requestKey' => 'key-cross-card',
        ], $student['csrf'])->assertStatus(409);

        $this->assertSame(1, FlashcardReview::query()->count());
    }

    public function test_a_review_without_a_request_key_is_allowed_and_not_deduplicated(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), ['rating' => 'good'], $student['csrf'])
            ->assertStatus(201);
        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), ['rating' => 'good'], $student['csrf'])
            ->assertStatus(201);

        $this->assertSame(2, FlashcardReview::query()->count());
        $this->assertSame(2, (int) FlashcardState::query()->sole()->review_count);
    }

    public function test_the_database_itself_refuses_a_duplicate_idempotency_record(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
            'requestKey' => 'key-db-guard',
        ], $student['csrf'])->assertStatus(201);

        /*
         * لایهٔ دوم: حتی اگر کد دور بزند، `UNIQUE(scope, actor_key, request_key)`
         * جلوی رکورد تکراری را می‌گیرد. این همان تضمین race-safe است.
         */
        $this->expectException(QueryException::class);

        DB::table('idempotency_keys')->insert([
            'id' => (string) Str::uuid(),
            'scope' => 'flashcards.review',
            'actor_key' => 'user:'.$student['user']->getKey(),
            'request_key' => 'key-db-guard',
            'request_hash' => str_repeat('a', 64),
            'state' => 'completed',
            'expires_at' => now()->addMinutes(30),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // ── مرز مالکیت و وضعیت ──────────────────────────────────────────────

    public function test_another_users_card_is_a_404_and_creates_nothing(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger);
        $card = $this->makeCard($deck);

        $student = $this->signedInStudent();

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->assertSame(0, FlashcardState::query()->count());
        $this->assertSame(0, FlashcardReview::query()->count());
    }

    public function test_a_card_in_a_published_official_deck_can_be_reviewed_by_any_student(): void
    {
        $official = $this->makeOfficialDeck();
        $card = $this->makeCard($official);

        $first = $this->signedInStudent(['phone' => '09120000101']);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $first['csrf'])->assertStatus(201);

        /* ورود دانش‌آموز دوم کوکی‌های کلاینت را عوض می‌کند. */
        $second = $this->signedInStudent(['phone' => '09120000102']);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'easy',
        ], $second['csrf'])->assertStatus(201);

        /* وضعیت یادگیری همیشه مال کاربر است: دو ردیف، دو کاربر، یک کارت. */
        $this->assertSame(2, FlashcardState::query()->count());
        $this->assertSame(
            [$first['user']->getKey(), $second['user']->getKey()],
            FlashcardState::query()->orderBy('user_id')->pluck('user_id')->all(),
        );
    }

    public function test_a_card_in_an_archived_deck_cannot_be_reviewed(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $deck->forceFill(['status' => FlashcardDeck::STATUS_ARCHIVED])->save();

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->assertSame(0, FlashcardReview::query()->count());
    }

    public function test_an_archived_card_cannot_be_reviewed(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck, ['status' => Flashcard::STATUS_ARCHIVED]);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(404);

        $this->assertSame(0, FlashcardReview::query()->count());
    }

    public function test_a_non_uuid_card_id_is_a_404_and_not_a_500(): void
    {
        $student = $this->signedInStudent();

        /* `whereUuid` روی مسیر — بدون آن PostgreSQL `22P02` و ۵۰۰ می‌دهد. */
        $this->postJsonWithOrigin('/api/v1/flashcards/review/not-a-uuid', [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(404);
    }

    public function test_a_deck_with_cards_cannot_be_deleted_so_no_review_can_be_orphaned(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        /* سرویس ۴۰۹ می‌دهد … */
        $this->deleteJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey(), [], $student['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'DECK_NOT_EMPTY');

        /* … و حتی حذف مستقیم مدل هم در سطح دیتابیس رد می‌شود (FK RESTRICT). */
        $this->expectException(QueryException::class);
        $deck->delete();
    }

    public function test_two_reviews_of_the_same_card_never_corrupt_the_state(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $first = $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        $second = $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        $state = FlashcardState::query()->sole();

        /* یک ردیف وضعیت، دو ردیف تاریخچه، شمارنده‌ها دقیقاً ۲. */
        $this->assertSame(1, FlashcardState::query()->count());
        $this->assertSame(2, FlashcardReview::query()->count());
        $this->assertSame(2, (int) $state->review_count);
        $this->assertSame(2, (int) $state->correct_count);
        $this->assertSame(0, (int) $state->lapse_count);

        /* نسخهٔ وضعیت با هر مرور بالا می‌رود — نشانهٔ serial شدن درست. */
        $this->assertGreaterThan(
            (int) $first->json('data.review.state.version'),
            (int) $second->json('data.review.state.version'),
        );

        /* مرور دوم وضعیت **تازه** را خوانده، نه عکس کهنه. */
        $this->assertSame(FlashcardState::STATE_REVIEW, $second->json('data.review.state.state'));
        $this->assertSame(
            $second->json('data.review.state.due_at'),
            $state->due_at?->toIso8601String(),
        );
    }

    public function test_the_database_itself_refuses_two_state_rows_for_one_user_and_card(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        $existing = FlashcardState::query()->sole();

        $this->expectException(QueryException::class);

        DB::table('flashcard_states')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $existing->user_id,
            'card_id' => $existing->card_id,
            'algorithm_version' => 'sm2-tapesh-v1',
            'state' => 'new',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // ── صف مرور ─────────────────────────────────────────────────────────

    public function test_the_queue_contains_new_cards_and_creates_no_state_rows(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $this->makeCards($deck, 2);

        $response = $this->getJson('/api/v1/flashcards/review/queue')->assertOk();

        $this->assertSame(2, $response->json('meta.count'));
        $this->assertNull($response->json('data.queue.0.state'));

        /* دیدن صف یک عملیات **خواندنی** است. */
        $this->assertSame(0, FlashcardState::query()->count());
    }

    public function test_a_reviewed_card_leaves_the_new_set_and_becomes_due(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        $state = FlashcardState::query()->sole();

        /* بازهٔ گام دوم = ۱ روز ⇒ الان due نیست. */
        $this->assertTrue($state->due_at->isFuture());
        $this->assertSame(0, $this->getJson('/api/v1/flashcards/review/queue')->assertOk()->json('meta.count'));

        /* با عقب‌بردن سررسید، همان کارت به صف برمی‌گردد — با وضعیت واقعی. */
        $state->forceFill(['due_at' => now()->subMinute()])->save();

        $response = $this->getJson('/api/v1/flashcards/review/queue')->assertOk();

        $this->assertSame(1, $response->json('meta.count'));
        $this->assertSame($card->getKey(), $response->json('data.queue.0.card.id'));
        $this->assertNotNull($response->json('data.queue.0.state'));
    }

    public function test_the_queue_never_exposes_another_users_deck(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger);
        $this->makeCard($deck);

        $this->signedInStudent();

        $this->getJson('/api/v1/flashcards/review/queue')->assertOk()->assertJsonPath('meta.count', 0);
    }

    public function test_asking_for_another_users_deck_in_the_queue_is_a_404(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger);

        $this->signedInStudent();

        $this->getJson('/api/v1/flashcards/review/queue?deckId='.$deck->getKey())
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_cram_mode_returns_active_cards_regardless_of_due_dates(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        $this->assertSame(0, $this->getJson('/api/v1/flashcards/review/queue')->assertOk()->json('meta.count'));
        $this->assertSame(1, $this->getJson('/api/v1/flashcards/review/queue?mode=cram')->assertOk()->json('meta.count'));
    }

    public function test_an_invalid_queue_mode_is_rejected(): void
    {
        $this->signedInStudent();

        $this->getJson('/api/v1/flashcards/review/queue?mode=everything')
            ->assertStatus(422)
            ->assertFieldError('mode');
    }

    public function test_the_queue_limit_is_capped(): void
    {
        $this->signedInStudent();

        $max = (int) config('flashcards.review.queue_limit_max');

        $this->getJson('/api/v1/flashcards/review/queue?limit='.($max + 1))
            ->assertStatus(422)
            ->assertFieldError('limit');
    }

    public function test_an_unknown_queue_parameter_is_rejected(): void
    {
        $this->signedInStudent();

        $this->getJson('/api/v1/flashcards/review/queue?userId=abc')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    // ── پیشرفت ──────────────────────────────────────────────────────────

    public function test_progress_is_derived_from_state_and_reviews(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $this->makeCards($deck, 3);

        $initial = $this->getJson('/api/v1/flashcards/progress')->assertOk();

        $this->assertSame(3, $initial->json('data.progress.total'));
        $this->assertSame(3, $initial->json('data.progress.new'));
        $this->assertSame(0, $initial->json('data.progress.reviewed_today'));
        $this->assertSame(0, $initial->json('data.progress.mastered'));

        $card = Flashcard::query()->orderBy('position')->firstOrFail();

        $this->postJsonWithOrigin($this->reviewUri($card->getKey()), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        $after = $this->getJson('/api/v1/flashcards/progress')->assertOk();

        $this->assertSame(3, $after->json('data.progress.total'));
        $this->assertSame(2, $after->json('data.progress.new'));
        $this->assertSame(1, $after->json('data.progress.learning'));
        $this->assertSame(1, $after->json('data.progress.reviewed_today'));
        $this->assertSame(0, $after->json('data.progress.due'));
    }

    public function test_progress_counts_suspended_cards_separately(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->postJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey().'/suspend', [
            'suspended' => true,
        ], $student['csrf'])->assertOk();

        $response = $this->getJson('/api/v1/flashcards/progress')->assertOk();

        $this->assertSame(1, $response->json('data.progress.suspended'));
        $this->assertSame(0, $response->json('data.progress.due'));
    }

    public function test_progress_for_a_student_with_no_deck_is_all_zero(): void
    {
        $this->signedInStudent();

        $response = $this->getJson('/api/v1/flashcards/progress')->assertOk();

        $this->assertSame(0, $response->json('data.progress.total'));
        $this->assertSame(0, $response->json('data.progress.new'));
    }

    public function test_the_progress_counters_are_not_stored_anywhere(): void
    {
        /*
         * هیچ ستون شمارشی روی `flashcard_states` وجود ندارد؛ اگر روزی کسی
         * اضافه کند، «وضعیت» و «آمار» می‌توانند واگرا شوند.
         */
        foreach (['total_cards', 'reviewed_count', 'mastered_count', 'progress'] as $column) {
            $this->assertFalse(Schema::hasColumn('flashcard_states', $column));
        }
    }
}
