<?php

namespace Tests\Feature\Flashcards;

use App\Models\Flashcard;
use App\Models\FlashcardState;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsFlashcards;
use Tests\TestCase;

/**
 * کارت‌های فلش‌کارت و اکشن‌های سطح وضعیت — فاز ۹.
 *
 * دو چیز اینجا قفل می‌شود که مستقیماً امنیت‌اند:
 *   ۱. محتوا **پیش از ذخیره** پاک‌سازی می‌شود، نه هنگام نمایش؛ پس payload
 *      خطرناک هرگز در دیتابیس نمی‌نشیند.
 *   ۲. نوشتن فقط روی کارت داخل دک شخصیِ خودِ کاربر؛ دک رسمی برای کاربر
 *      فقط‌خواندنی است.
 */
class FlashcardCardTest extends TestCase
{
    use BuildsFlashcards, RefreshDatabase;

    // ── ساخت ────────────────────────────────────────────────────────────

    public function test_a_single_card_is_created_with_position_one(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $response = $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/cards', [
            'front' => 'کلیه',
            'back' => 'نفرون',
        ], $student['csrf'])->assertStatus(201);

        $this->assertSame('کلیه', $response->json('data.card.front'));
        $this->assertSame(1, $response->json('data.card.position'));
        $this->assertSame(Flashcard::STATUS_ACTIVE, $response->json('data.card.status'));
    }

    public function test_a_batch_import_creates_all_cards_in_order(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $response = $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/cards', [
            'cards' => [
                ['front' => 'الف', 'back' => '۱'],
                ['front' => 'ب', 'back' => '۲'],
                ['front' => 'ج', 'back' => '۳'],
            ],
        ], $student['csrf'])->assertStatus(201);

        $this->assertSame(3, $response->json('meta.created'));
        $this->assertSame([1, 2, 3], array_column($response->json('data.cards'), 'position'));
        $this->assertSame(3, Flashcard::query()->where('deck_id', $deck->getKey())->count());
    }

    public function test_positions_keep_incrementing_across_requests(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/cards', [
            'front' => 'الف', 'back' => '۱',
        ], $student['csrf'])->assertStatus(201);

        $second = $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/cards', [
            'front' => 'ب', 'back' => '۲',
        ], $student['csrf'])->assertStatus(201);

        $this->assertSame(2, $second->json('data.card.position'));
    }

    public function test_too_many_cards_in_one_batch_are_rejected(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $max = (int) config('flashcards.decks.max_cards_per_request');
        $cards = [];

        foreach (range(1, $max + 1) as $index) {
            $cards[] = ['front' => 'f'.$index, 'back' => 'b'.$index];
        }

        $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/cards', [
            'cards' => $cards,
        ], $student['csrf'])
            ->assertStatus(422)
            ->assertFieldError('cards');
    }

    public function test_the_client_cannot_set_the_card_status(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/cards', [
            'front' => 'الف',
            'back' => '۱',
            'status' => Flashcard::STATUS_ARCHIVED,
        ], $student['csrf'])
            ->assertStatus(422)
            ->assertFieldError('status');
    }

    public function test_empty_card_content_is_rejected(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        /*
         * فاصلهٔ خالی از نظر `required` لاراول «خالی» است، پس همان لایهٔ
         * اعتبارسنجی رد می‌کند و به سرویس نمی‌رسد. هر دو لایه ۴۲۲ می‌دهند؛
         * چیزی که مهم است این است که کارت خالی هرگز ذخیره نمی‌شود.
         */
        $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/cards', [
            'front' => '   ',
            'back' => '۱',
        ], $student['csrf'])
            ->assertStatus(422)
            ->assertFieldError('front');

        $this->assertSame(0, Flashcard::query()->count());
    }

    // ── پاک‌سازی محتوا ──────────────────────────────────────────────────

    public function test_dangerous_markup_is_stripped_before_it_is_stored(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/cards', [
            'front' => '<script>alert(1)</script>کلیه',
            'back' => '<b>نفرون</b><img src=x onerror=alert(1)>',
        ], $student['csrf'])->assertStatus(201);

        $card = Flashcard::query()->sole();

        /*
         * پروفایل کارت `inline` است: `<script>` با کل محتوایش حذف می‌شود و
         * `<img>` (تگ غیرمجاز) به **متن دیده‌شدنی** تبدیل می‌شود — نه اینکه
         * حذف شود. در هر دو حالت هیچ تگ اجرایی در دیتابیس نمی‌نشیند.
         */
        $this->assertStringNotContainsString('<script', $card->front);
        $this->assertStringContainsString('کلیه', $card->front);

        $this->assertStringNotContainsString('<img', $card->back);
        $this->assertStringNotContainsString('<script', $card->back);
        $this->assertStringContainsString('<b>نفرون</b>', $card->back);
        $this->assertStringContainsString('onerror=alert(1)', $card->back);
    }

    // ── فهرست ───────────────────────────────────────────────────────────

    public function test_the_deck_card_list_is_paginated_and_ordered(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $this->makeCards($deck, 3);

        $response = $this->getJson('/api/v1/flashcards/decks/'.$deck->getKey().'/cards?perPage=2')->assertOk();

        $response->assertJsonCount(2, 'data.cards');
        $this->assertSame(3, $response->json('meta.total'));
        $this->assertSame(2, $response->json('meta.lastPage'));
        $this->assertSame($deck->getKey(), $response->json('data.deck.id'));
    }

    public function test_another_users_deck_card_list_is_a_404(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger);
        $this->makeCard($deck);

        $this->signedInStudent();

        $this->getJson('/api/v1/flashcards/decks/'.$deck->getKey().'/cards')->assertStatus(404);
    }

    public function test_the_card_search_filters_by_text_and_by_the_users_own_state(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $match = $this->makeCard($deck, ['front' => 'بیماری کلیه', 'back' => 'x']);
        $other = $this->makeCard($deck, ['front' => 'قلب', 'back' => 'y']);

        $items = $this->getJson('/api/v1/flashcards/cards?q='.rawurlencode('کلیه'))->assertOk()->json('data.cards');
        $ids = array_column(array_column($items, 'card'), 'id');

        $this->assertSame([$match->getKey()], $ids);
        $this->assertNotContains($other->getKey(), $ids);

        /* هر آیتم جست‌وجو وضعیت **خودِ کاربر** را هم همراه دارد. */
        $this->assertArrayHasKey('state', $items[0]);
    }

    public function test_the_bookmarked_filter_only_returns_my_own_bookmarks(): void
    {
        $student = $this->signedInStudent();
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($student['user']);

        $bookmarked = $this->makeCard($deck, ['front' => 'نشان‌شده']);
        $plain = $this->makeCard($deck, ['front' => 'بی‌نشان']);

        /* نشان واقعی از مسیر API ساخته می‌شود، نه با دست‌کاری دیتابیس. */
        $this->postJsonWithOrigin('/api/v1/flashcards/cards/'.$bookmarked->getKey().'/bookmark', [
            'bookmarked' => true,
        ], $student['csrf'])->assertOk();

        $items = $this->getJson('/api/v1/flashcards/cards?bookmarked=true')->assertOk()->json('data.cards');
        $ids = array_column(array_column($items, 'card'), 'id');

        $this->assertSame([$bookmarked->getKey()], $ids);
        $this->assertNotContains($plain->getKey(), $ids);

        /* وضعیت کاربر دیگر روی خروجی من اثری ندارد. */
        $this->assertSame(0, FlashcardState::query()->where('user_id', $stranger->getKey())->count());
    }

    public function test_an_unknown_query_parameter_on_the_card_search_is_rejected(): void
    {
        $this->signedInStudent();

        $this->getJson('/api/v1/flashcards/cards?userId=abc')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    // ── ویرایش و حذف ────────────────────────────────────────────────────

    public function test_the_owner_can_update_a_card(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck, ['front' => 'قدیمی']);

        $response = $this->patchJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey(), [
            'front' => 'تازه',
        ], $student['csrf'])->assertOk();

        $this->assertSame('تازه', $response->json('data.card.front'));
    }

    public function test_an_unreviewed_card_is_deleted_physically(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $response = $this->deleteJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey(), [], $student['csrf'])
            ->assertOk();

        $this->assertSame('deleted', $response->json('data.outcome'));
        $this->assertNull(Flashcard::query()->find($card->getKey()));
    }

    public function test_a_reviewed_card_is_archived_instead_of_deleted_so_the_history_survives(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        /* یک مرور واقعی ⇒ تاریخچه ساخته می‌شود. */
        $this->postJsonWithOrigin('/api/v1/flashcards/review/'.$card->getKey(), [
            'rating' => 'good',
        ], $student['csrf'])->assertStatus(201);

        $response = $this->deleteJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey(), [], $student['csrf'])
            ->assertOk();

        $this->assertSame('archived', $response->json('data.outcome'));

        $stored = Flashcard::query()->findOrFail($card->getKey());
        $this->assertSame(Flashcard::STATUS_ARCHIVED, $stored->status);
        $this->assertSame(1, FlashcardState::query()->where('card_id', $card->getKey())->count());
    }

    // ── مرز مالکیت ──────────────────────────────────────────────────────

    public function test_a_card_in_another_users_deck_cannot_be_written(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger);
        $card = $this->makeCard($deck, ['front' => 'مال دیگری']);

        $student = $this->signedInStudent();

        $this->patchJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey(), [
            'front' => 'دستکاری',
        ], $student['csrf'])->assertStatus(404);

        $this->deleteJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey(), [], $student['csrf'])
            ->assertStatus(404);

        $this->assertSame('مال دیگری', Flashcard::query()->findOrFail($card->getKey())->front);
    }

    public function test_a_card_in_an_official_deck_cannot_be_written_by_a_user(): void
    {
        $official = $this->makeOfficialDeck();
        $card = $this->makeCard($official);

        $student = $this->signedInStudent();

        $this->patchJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey(), [
            'front' => 'دستکاری',
        ], $student['csrf'])->assertStatus(403);

        $this->deleteJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey(), [], $student['csrf'])
            ->assertStatus(403);

        $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$official->getKey().'/cards', [
            'front' => 'کارت جعلی', 'back' => 'x',
        ], $student['csrf'])->assertStatus(403);
    }

    // ── اکشن‌های وضعیت ─────────────────────────────────────────────────

    public function test_suspending_a_card_flags_the_state_without_touching_the_algorithm_values(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $response = $this->postJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey().'/suspend', [
            'suspended' => true,
        ], $student['csrf'])->assertOk();

        $this->assertTrue($response->json('data.state.suspended'));
        $this->assertSame(0, $response->json('data.state.interval_minutes'));
        $this->assertSame(2.5, (float) $response->json('data.state.ease'));

        $state = FlashcardState::query()->sole();
        $this->assertTrue((bool) $state->suspended);
        $this->assertSame(0, (int) $state->review_count);
    }

    public function test_a_suspended_card_leaves_the_review_queue(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $this->assertSame(1, $this->getJson('/api/v1/flashcards/review/queue')->assertOk()->json('meta.count'));

        $this->postJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey().'/suspend', [
            'suspended' => true,
        ], $student['csrf'])->assertOk();

        $this->assertSame(0, $this->getJson('/api/v1/flashcards/review/queue')->assertOk()->json('meta.count'));
    }

    public function test_burying_a_card_hides_it_until_the_requested_day(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $response = $this->postJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey().'/bury', [
            'days' => 3,
        ], $student['csrf'])->assertOk();

        $this->assertNotNull($response->json('data.state.buried_until'));
        $this->assertSame(0, $this->getJson('/api/v1/flashcards/review/queue')->assertOk()->json('meta.count'));
    }

    public function test_the_bury_window_is_capped(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $card = $this->makeCard($deck);

        $max = (int) config('flashcards.review.max_bury_days');

        $this->postJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey().'/bury', [
            'days' => $max + 1,
        ], $student['csrf'])
            ->assertStatus(422)
            ->assertFieldError('days');
    }

    public function test_a_state_action_on_another_users_card_is_a_404(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger);
        $card = $this->makeCard($deck);

        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/flashcards/cards/'.$card->getKey().'/suspend', [], $student['csrf'])
            ->assertStatus(404);

        $this->assertSame(0, FlashcardState::query()->count());
    }
}
