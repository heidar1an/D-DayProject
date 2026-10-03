<?php

namespace Tests\Feature\Flashcards;

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsFlashcards;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * دک رسمی در پنل — فاز ۹.
 *
 * دو چیز اینجا قفل می‌شود:
 *   ۱. **deny-by-default**: ادمین بدون نقش هیچ مسیری نمی‌بیند، و ادمین
 *      `editor` که `flashcards.delete` ندارد نمی‌تواند حذف کند.
 *   ۲. **مالکیت دک رسمی**: `owner_user_id` همیشه `null` می‌ماند و
 *      `author_admin_id` از سشن ادمین می‌آید، نه از بدنه.
 *
 * مجوزها همان کلیدهای واقعی `AdminRbacSeeder` هستند — هیچ `wiki.*`/`flashcards.*`
 * اختراعی اینجا ساخته نمی‌شود.
 */
class AdminFlashcardTest extends TestCase
{
    use BuildsFlashcards, InteractsWithAdmin, RefreshDatabase;

    private const DECKS = '/api/v1/admin/flashcards/decks';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    // ── deny-by-default ────────────────────────────────────────────────

    public function test_a_guest_is_rejected(): void
    {
        $this->forgetCookies();

        $this->getJson(self::DECKS)->assertStatus(401);
        $this->postJsonWithOrigin(self::DECKS, ['title' => 'x'])->assertStatus(401);
    }

    public function test_an_admin_without_any_role_is_denied_on_every_route(): void
    {
        $roleless = $this->makeRolelessAdmin();
        $this->actingAsAdmin($roleless);

        $deck = $this->makeOfficialDeck();
        $card = $this->makeCard($deck);

        $this->getJson(self::DECKS)->assertStatus(403);
        $this->getJson(self::DECKS.'/'.$deck->getKey())->assertStatus(403);
        $this->getJson(self::DECKS.'/'.$deck->getKey().'/cards')->assertStatus(403);
        $this->postJsonWithOrigin(self::DECKS, ['title' => 'x'], $this->adminCsrf())->assertStatus(403);
        $this->patchJsonWithOrigin(self::DECKS.'/'.$deck->getKey(), ['title' => 'x'], $this->adminCsrf())->assertStatus(403);
        $this->deleteJsonWithOrigin(self::DECKS.'/'.$deck->getKey(), [], $this->adminCsrf())->assertStatus(403);
        $this->postJsonWithOrigin(self::DECKS.'/'.$deck->getKey().'/publish', [], $this->adminCsrf())->assertStatus(403);
        $this->patchJsonWithOrigin('/api/v1/admin/flashcards/cards/'.$card->getKey(), ['front' => 'x'], $this->adminCsrf())->assertStatus(403);
    }

    public function test_an_editor_cannot_delete_because_the_real_role_lacks_that_permission(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $deck = $this->makeOfficialDeck();

        /* editor مجوز `flashcards.delete` ندارد — و مجوز اختراعی هم اضافه نشد. */
        $this->deleteJsonWithOrigin(self::DECKS.'/'.$deck->getKey(), [], $this->adminCsrf())
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        $this->assertNotNull(FlashcardDeck::query()->find($deck->getKey()));
    }

    // ── ساخت دک رسمی ───────────────────────────────────────────────────

    public function test_an_editor_creates_an_official_deck_owned_by_nobody(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $response = $this->postJsonWithOrigin(self::DECKS, [
            'title' => 'دک رسمی آناتومی',
            'owner_user_id' => User::factory()->create()->getKey(),
            'authorAdminId' => 'ignored',
            'status' => FlashcardDeck::STATUS_PUBLISHED,
        ], $this->adminCsrf())->assertStatus(201);

        $deck = FlashcardDeck::query()->sole();

        $this->assertNull($deck->owner_user_id);
        $this->assertSame($editor->getKey(), $deck->author_admin_id);
        $this->assertSame(FlashcardDeck::STATUS_DRAFT, $deck->status);
        $this->assertSame(FlashcardDeck::VISIBILITY_PUBLIC, $deck->visibility);
        $this->assertTrue($response->json('data.deck.is_official'));
    }

    public function test_cards_can_be_added_to_an_official_deck_and_then_published(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $deck = $this->makeOfficialDeck(['status' => FlashcardDeck::STATUS_DRAFT]);

        $this->postJsonWithOrigin(self::DECKS.'/'.$deck->getKey().'/cards', [
            'front' => 'کلیه',
            'back' => 'نفرون',
        ], $this->adminCsrf())->assertStatus(201);

        $published = $this->postJsonWithOrigin(self::DECKS.'/'.$deck->getKey().'/publish', [], $this->adminCsrf())
            ->assertOk();

        $this->assertSame(FlashcardDeck::STATUS_PUBLISHED, $published->json('data.deck.status'));
        $this->assertNotNull($published->json('data.deck.published_at'));

        /* حالا برای دانش‌آموز خواندنی است — و دک رسمی‌اش دست‌نخورده. */
        $student = $this->signedInStudent();
        $this->getJson('/api/v1/flashcards/decks/'.$deck->getKey())->assertOk();
        $this->patchJsonWithOrigin('/api/v1/flashcards/decks/'.$deck->getKey(), [
            'title' => 'دستکاری',
        ], $student['csrf'])->assertStatus(403);
    }

    public function test_an_archived_official_deck_rejects_new_cards(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $deck = $this->makeOfficialDeck(['status' => FlashcardDeck::STATUS_ARCHIVED]);

        $this->postJsonWithOrigin(self::DECKS.'/'.$deck->getKey().'/cards', [
            'front' => 'x', 'back' => 'y',
        ], $this->adminCsrf())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'DECK_ARCHIVED');
    }

    // ── ویرایش رسمی ────────────────────────────────────────────────────

    public function test_the_admin_update_advances_the_version_and_a_stale_version_is_a_409(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $deck = $this->makeOfficialDeck();

        $this->patchJsonWithOrigin(self::DECKS.'/'.$deck->getKey(), [
            'title' => 'عنوان تازه',
            'version' => 1,
        ], $this->adminCsrf())->assertOk()->assertJsonPath('data.deck.version', 2);

        $this->patchJsonWithOrigin(self::DECKS.'/'.$deck->getKey(), [
            'title' => 'بازنویسی',
            'version' => 1,
        ], $this->adminCsrf())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'VERSION_CONFLICT');
    }

    public function test_a_personal_deck_cannot_be_edited_from_the_admin_surface(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $personal = $this->makeDeck(User::factory()->create());

        $this->patchJsonWithOrigin(self::DECKS.'/'.$personal->getKey(), [
            'title' => 'دستکاری',
        ], $this->adminCsrf())
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_the_admin_list_can_filter_official_decks_only(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $official = $this->makeOfficialDeck();
        $personal = $this->makeDeck(User::factory()->create());

        $ids = array_column(
            $this->getJson(self::DECKS.'?owner=official')->assertOk()->json('data.decks'),
            'id',
        );

        $this->assertSame([$official->getKey()], $ids);
        $this->assertNotContains($personal->getKey(), $ids);
    }

    public function test_the_admin_card_list_includes_archived_cards(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $deck = $this->makeOfficialDeck();
        $this->makeCard($deck, ['front' => 'فعال']);
        $this->makeCard($deck, ['front' => 'آرشیو', 'status' => Flashcard::STATUS_ARCHIVED]);

        $response = $this->getJson(self::DECKS.'/'.$deck->getKey().'/cards')->assertOk();

        $this->assertSame(2, $response->json('meta.total'));
    }

    public function test_an_unknown_admin_query_parameter_is_rejected(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $this->getJson(self::DECKS.'?userId=abc')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    public function test_a_missing_deck_is_a_404_in_the_admin_surface(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $this->getJson(self::DECKS.'/00000000-0000-0000-0000-000000000000')->assertStatus(404);
        $this->getJson(self::DECKS.'/not-a-uuid')->assertStatus(404);
    }

    public function test_an_admin_write_without_a_csrf_token_is_rejected(): void
    {
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $this->postJson(self::DECKS, ['title' => 'x'], ['Origin' => $this->origin()])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'CSRF_FAILED');
    }
}
