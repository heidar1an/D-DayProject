<?php

namespace Tests\Feature\Flashcards;

use App\Models\FlashcardDeck;
use App\Models\FlashcardState;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsFlashcards;
use Tests\TestCase;

/**
 * دک‌های فلش‌کارت — فاز ۹.
 *
 * مرزهای قفل‌شده اینجا:
 *   • مالکیت فقط از **سشن** می‌آید؛ `userId`/`ownerUserId` در بدنه بی‌اثر است.
 *   • دک رسمی (`owner_user_id = null`) برای کاربر فقط خواندنی است.
 *   • دک شخصی هرگز — حتی با `visibility = public` — برای کاربر دیگر خواندنی نیست.
 *   • شناسهٔ ناموجود و شناسهٔ غیرمجاز هر دو ۴۰۴ می‌گیرند (وجود لو نمی‌رود).
 */
class FlashcardDeckTest extends TestCase
{
    use BuildsFlashcards, RefreshDatabase;

    // ── احراز هویت ──────────────────────────────────────────────────────

    public function test_a_guest_cannot_list_or_create_decks(): void
    {
        $this->forgetCookies();

        $this->getJson('/api/v1/flashcards/decks')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');

        $this->postJsonWithOrigin('/api/v1/flashcards/decks', ['title' => 'دک'])
            ->assertStatus(401);
    }

    // ── ساخت ────────────────────────────────────────────────────────────

    public function test_a_created_deck_is_owned_by_the_session_user_and_starts_private_and_draft(): void
    {
        $student = $this->signedInStudent();

        $response = $this->postJsonWithOrigin('/api/v1/flashcards/decks', [
            'title' => 'قلب و عروق',
            'description' => 'مرور سریع',
        ], $student['csrf'])->assertStatus(201);

        $this->assertSame('قلب و عروق', $response->json('data.deck.title'));
        $this->assertTrue($response->json('data.deck.is_owned'));
        $this->assertFalse($response->json('data.deck.is_official'));
        $this->assertSame(FlashcardDeck::STATUS_DRAFT, $response->json('data.deck.status'));
        $this->assertSame(FlashcardDeck::VISIBILITY_PRIVATE, $response->json('data.deck.visibility'));

        $deck = FlashcardDeck::query()->sole();
        $this->assertSame($student['user']->getKey(), $deck->owner_user_id);
        $this->assertNull($deck->author_admin_id);

        /* `owner_user_id` هرگز serialize نمی‌شود. */
        $this->assertArrayNotHasKey('owner_user_id', $response->json('data.deck'));
    }

    public function test_the_client_cannot_choose_the_owner_or_the_status_of_a_new_deck(): void
    {
        $student = $this->signedInStudent();
        $other = User::factory()->create();

        $this->postJsonWithOrigin('/api/v1/flashcards/decks', [
            'title' => 'دک',
            'ownerUserId' => $other->getKey(),
            'owner_user_id' => $other->getKey(),
            'authorAdminId' => $other->getKey(),
        ], $student['csrf'])->assertStatus(201);

        $deck = FlashcardDeck::query()->sole();
        $this->assertSame($student['user']->getKey(), $deck->owner_user_id);
    }

    public function test_a_title_with_markup_is_stored_as_plain_text(): void
    {
        $student = $this->signedInStudent();

        $response = $this->postJsonWithOrigin('/api/v1/flashcards/decks', [
            'title' => '<b>قلب</b><script>alert(1)</script>',
        ], $student['csrf'])->assertStatus(201);

        $this->assertSame('قلبalert(1)', $response->json('data.deck.title'));
        $this->assertStringNotContainsString('<', (string) $response->json('data.deck.title'));
    }

    public function test_a_missing_title_is_rejected(): void
    {
        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/flashcards/decks', [], $student['csrf'])
            ->assertStatus(422)
            ->assertFieldError('title');
    }

    // ── مرز دسترسی در فهرست ─────────────────────────────────────────────

    public function test_the_list_contains_my_decks_and_published_official_decks_only(): void
    {
        $student = $this->signedInStudent();
        $stranger = User::factory()->create();

        $mine = $this->makeDeck($student['user'], ['title' => 'دک من']);
        $strangersPrivate = $this->makeDeck($stranger, ['title' => 'دک دیگری']);
        $strangersPublic = $this->makeDeck($stranger, [
            'title' => 'دک عمومی دیگری',
            'visibility' => FlashcardDeck::VISIBILITY_PUBLIC,
        ]);
        $official = $this->makeOfficialDeck(['title' => 'دک رسمی']);
        $officialDraft = $this->makeOfficialDeck([
            'title' => 'دک رسمی پیش‌نویس',
            'status' => FlashcardDeck::STATUS_DRAFT,
        ]);

        $ids = array_column(
            $this->getJson('/api/v1/flashcards/decks')->assertOk()->json('data.decks'),
            'id',
        );

        $this->assertContains($mine->getKey(), $ids);
        $this->assertContains($official->getKey(), $ids);

        /* دک شخصی دیگران — حتی «عمومی» — خواندنی نیست (محافظه‌کارانه‌تر از spec). */
        $this->assertNotContains($strangersPrivate->getKey(), $ids);
        $this->assertNotContains($strangersPublic->getKey(), $ids);
        $this->assertNotContains($officialDraft->getKey(), $ids);
    }

    public function test_the_owner_filter_narrows_to_my_decks_or_to_official_ones(): void
    {
        $student = $this->signedInStudent();

        $mine = $this->makeDeck($student['user']);
        $official = $this->makeOfficialDeck();

        $mineIds = array_column(
            $this->getJson('/api/v1/flashcards/decks?owner=me')->assertOk()->json('data.decks'),
            'id',
        );
        $this->assertSame([$mine->getKey()], $mineIds);

        $officialIds = array_column(
            $this->getJson('/api/v1/flashcards/decks?owner=official')->assertOk()->json('data.decks'),
            'id',
        );
        $this->assertSame([$official->getKey()], $officialIds);
    }

    public function test_an_unknown_query_parameter_is_rejected_with_400(): void
    {
        $this->signedInStudent();

        $this->getJson('/api/v1/flashcards/decks?userId=whatever')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    public function test_per_page_above_the_ceiling_is_rejected(): void
    {
        $this->signedInStudent();

        $max = (int) config('flashcards.pagination.max_per_page');

        $this->getJson('/api/v1/flashcards/decks?perPage='.($max + 1))
            ->assertStatus(422)
            ->assertFieldError('perPage');
    }

    // ── خواندن یک دک ────────────────────────────────────────────────────

    public function test_another_users_deck_is_a_404_not_a_403(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger);

        $this->signedInStudent();

        $this->getJson('/api/v1/flashcards/decks/'.$deck->getKey())
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_a_published_official_deck_is_readable_by_any_signed_in_student(): void
    {
        $official = $this->makeOfficialDeck();

        $this->signedInStudent();

        $response = $this->getJson('/api/v1/flashcards/decks/'.$official->getKey())->assertOk();

        $this->assertTrue($response->json('data.deck.is_official'));
        $this->assertFalse($response->json('data.deck.is_owned'));
    }

    public function test_a_non_uuid_deck_id_is_a_404_and_not_a_500(): void
    {
        $this->signedInStudent();

        /* `whereUuid` روی مسیر — بدون آن PostgreSQL `22P02` و ۵۰۰ می‌دهد. */
        $this->getJson('/api/v1/flashcards/decks/not-a-uuid')->assertStatus(404);
    }

    // ── ویرایش ──────────────────────────────────────────────────────────

    public function test_the_owner_can_update_the_title_and_the_version_advances(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user'], ['title' => 'قدیمی']);

        $response = $this->patchJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey(), [
            'title' => 'تازه',
            'version' => 1,
        ], $student['csrf'])->assertOk();

        $this->assertSame('تازه', $response->json('data.deck.title'));
        $this->assertSame(2, $response->json('data.deck.version'));
    }

    public function test_a_stale_version_is_a_409(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $this->patchJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey(), [
            'title' => 'اول',
            'version' => 1,
        ], $student['csrf'])->assertOk();

        $this->patchJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey(), [
            'title' => 'دوم',
            'version' => 1,
        ], $student['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'VERSION_CONFLICT');

        $this->assertSame('اول', FlashcardDeck::query()->findOrFail($deck->getKey())->title);
    }

    public function test_an_official_deck_cannot_be_updated_by_a_user(): void
    {
        $official = $this->makeOfficialDeck();
        $student = $this->signedInStudent();

        $this->patchJsonWithOrigin('/api/v1/flashcards/decks/'.$official->getKey(), [
            'title' => 'دستکاری',
        ], $student['csrf'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        $this->assertNotSame('دستکاری', FlashcardDeck::query()->findOrFail($official->getKey())->title);
    }

    public function test_another_users_deck_cannot_be_updated(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger, ['title' => 'مال دیگری']);

        $student = $this->signedInStudent();

        $this->patchJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey(), [
            'title' => 'دستکاری',
        ], $student['csrf'])->assertStatus(404);

        $this->assertSame('مال دیگری', FlashcardDeck::query()->findOrFail($deck->getKey())->title);
    }

    // ── حذف ─────────────────────────────────────────────────────────────

    public function test_an_empty_deck_can_be_deleted(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);

        $this->deleteJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey(), [], $student['csrf'])
            ->assertNoContent();

        $this->assertNull(FlashcardDeck::query()->find($deck->getKey()));
    }

    public function test_a_deck_with_cards_cannot_be_deleted(): void
    {
        $student = $this->signedInStudent();
        $deck = $this->makeDeck($student['user']);
        $this->makeCard($deck);

        $this->deleteJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey(), [], $student['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'DECK_NOT_EMPTY');

        $this->assertNotNull(FlashcardDeck::query()->find($deck->getKey()));
    }

    // ── کلون ────────────────────────────────────────────────────────────

    public function test_cloning_an_official_deck_creates_a_personal_copy_without_review_history(): void
    {
        $official = $this->makeOfficialDeck(['title' => 'دک رسمی']);
        $this->makeCards($official, 3);

        $student = $this->signedInStudent();

        $response = $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$official->getKey().'/clone', [
            'title' => 'کپی من',
        ], $student['csrf'])->assertStatus(201);

        $clone = FlashcardDeck::query()->findOrFail($response->json('data.deck.id'));

        $this->assertSame($student['user']->getKey(), $clone->owner_user_id);
        $this->assertSame('کپی من', $clone->title);
        $this->assertSame(3, $clone->cards()->count());

        /* دک رسمی دست‌نخورده مانده و تاریخچه‌ای منتقل نشده. */
        $this->assertSame(3, $official->cards()->count());
        $this->assertSame(0, FlashcardState::query()->count());
    }

    public function test_a_personal_deck_cannot_be_cloned(): void
    {
        $stranger = User::factory()->create();
        $deck = $this->makeDeck($stranger);

        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey().'/clone', [], $student['csrf'])
            ->assertStatus(404);
    }

    public function test_an_unpublished_official_deck_cannot_be_cloned(): void
    {
        $official = $this->makeOfficialDeck(['status' => FlashcardDeck::STATUS_ARCHIVED]);
        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/flashcards/decks/'.$official->getKey().'/clone', [], $student['csrf'])
            ->assertStatus(404);
    }

    // ── CSRF / Origin ───────────────────────────────────────────────────

    public function test_a_write_without_a_csrf_header_is_rejected(): void
    {
        $this->signedInStudent();

        $this->postJson('/api/v1/flashcards/decks', ['title' => 'دک'], ['Origin' => $this->origin()])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'CSRF_FAILED');
    }

    public function test_a_cross_origin_write_is_rejected(): void
    {
        $student = $this->signedInStudent();

        $this->postJson('/api/v1/flashcards/decks', ['title' => 'دک'], [
            'Origin' => 'http://evil.example',
            ...$student['csrf'],
        ])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }
}
