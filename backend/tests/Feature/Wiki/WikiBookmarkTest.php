<?php

namespace Tests\Feature\Wiki;

use App\Events\Wiki\WikiArticleOpened;
use App\Events\Wiki\WikiBookmarkAdded;
use App\Events\Wiki\WikiBookmarkRemoved;
use App\Models\User;
use App\Models\WikiArticle;
use App\Models\WikiBookmark;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsWiki;
use Tests\TestCase;

/**
 * نشان‌گذاری مقاله — فاز ۱۰.
 *
 * قفل‌های اصلی (IDOR §40):
 *   • هویت فقط از **سشن**؛ هیچ مسیری `userId` نمی‌پذیرد.
 *   • `UNIQUE(user_id, article_id)` تضمین race-safe است: دو درخواست هم‌زمان یک
 *     رکورد می‌سازند، نه دو.
 *   • افزودن/حذف نشان idempotent است؛ نشان‌گذاری پیش‌نویس ۴۰۴ می‌گیرد.
 */
class WikiBookmarkTest extends TestCase
{
    use BuildsWiki, RefreshDatabase;

    private const BOOKMARKS = '/api/v1/me/wiki-bookmarks';

    private function add(array $csrf, string $articleId)
    {
        return $this->putJsonWithOrigin(self::BOOKMARKS.'/'.$articleId, [], $csrf);
    }

    private function remove(array $csrf, string $articleId)
    {
        return $this->deleteJsonWithOrigin(self::BOOKMARKS.'/'.$articleId, [], $csrf);
    }

    // ── افزودن ──────────────────────────────────────────────────────────

    public function test_a_student_can_bookmark_a_published_article(): void
    {
        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'bookmarked-one']);

        $response = $this->add($student['csrf'], $article->getKey())->assertStatus(201);

        $this->assertSame($article->getKey(), $response->json('data.bookmark.article_id'));
        $this->assertArrayNotHasKey('user_id', $response->json('data.bookmark'));
        $this->assertSame(1, WikiBookmark::query()->count());
    }

    public function test_adding_the_same_bookmark_twice_creates_one_row(): void
    {
        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'twice']);

        $this->add($student['csrf'], $article->getKey())->assertStatus(201);
        $this->add($student['csrf'], $article->getKey())->assertStatus(201);

        $this->assertSame(1, WikiBookmark::query()->count());
    }

    public function test_the_database_itself_refuses_a_duplicate_bookmark(): void
    {
        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'unique-guard']);

        $this->add($student['csrf'], $article->getKey())->assertStatus(201);

        $existing = WikiBookmark::query()->sole();

        $this->expectException(QueryException::class);

        DB::table('wiki_bookmarks')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $existing->user_id,
            'article_id' => $existing->article_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_bookmarking_a_draft_or_archived_article_is_a_404(): void
    {
        $student = $this->signedInStudent();

        $draft = $this->makeArticle(['slug' => 'draft-target']);
        $archived = $this->makeArticle(['slug' => 'archived-target', 'status' => WikiArticle::STATUS_ARCHIVED]);

        $this->add($student['csrf'], $draft->getKey())
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->add($student['csrf'], $archived->getKey())->assertStatus(404);

        $this->assertSame(0, WikiBookmark::query()->count());
    }

    public function test_a_non_uuid_article_id_is_a_404_and_not_a_500(): void
    {
        $student = $this->signedInStudent();

        $this->add($student['csrf'], 'not-a-uuid')->assertStatus(404);
    }

    // ── فهرست ───────────────────────────────────────────────────────────

    public function test_the_bookmark_list_is_scoped_to_the_session_user(): void
    {
        $mine = $this->signedInStudent(['phone' => '09120000201']);
        $article = $this->makePublishedArticle(['slug' => 'mine-only']);

        $this->add($mine['csrf'], $article->getKey())->assertStatus(201);

        /* کاربر دیگر وارد می‌شود ⇒ کوکی‌های کلاینت عوض می‌شوند. */
        $other = $this->signedInStudent(['phone' => '09120000202']);

        $response = $this->getJson(self::BOOKMARKS)->assertOk();

        $this->assertSame(0, $response->json('meta.total'));

        /* و لیست کاربر اول همچنان یک نشان دارد. */
        $this->withAuthCookies($mine['session']);
        $this->assertSame(1, $this->getJson(self::BOOKMARKS)->assertOk()->json('meta.total'));
        $this->assertSame(
            $article->getKey(),
            $this->getJson(self::BOOKMARKS)->json('data.bookmarks.0.article_id'),
        );

        /* کاربر دیگر هیچ نشان و هیچ رکوردی ندارد — فهرستش خالی است. */
        $this->assertSame(0, WikiBookmark::query()->where('user_id', $other['user']->getKey())->count());
    }

    public function test_the_bookmark_list_hides_unpublished_articles(): void
    {
        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'will-be-archived']);

        $this->add($student['csrf'], $article->getKey())->assertStatus(201);

        $this->assertSame(1, $this->getJson(self::BOOKMARKS)->assertOk()->json('meta.total'));

        $article->forceFill(['status' => WikiArticle::STATUS_ARCHIVED])->save();

        $this->assertSame(0, $this->getJson(self::BOOKMARKS)->assertOk()->json('meta.total'));

        /* نشان حذف نشده؛ فقط از فهرست عمومی ناپدید شده. */
        $this->assertSame(1, WikiBookmark::query()->count());
    }

    public function test_an_unknown_list_parameter_is_rejected(): void
    {
        $this->signedInStudent();

        $this->getJson(self::BOOKMARKS.'?userId=abc')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    // ── حذف ─────────────────────────────────────────────────────────────

    public function test_removing_a_bookmark_is_idempotent(): void
    {
        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'removable']);

        $this->add($student['csrf'], $article->getKey())->assertStatus(201);

        $this->remove($student['csrf'], $article->getKey())->assertNoContent();
        $this->remove($student['csrf'], $article->getKey())->assertNoContent();

        $this->assertSame(0, WikiBookmark::query()->count());
    }

    public function test_removing_a_bookmark_for_a_missing_article_is_a_404(): void
    {
        $student = $this->signedInStudent();

        $this->remove($student['csrf'], '00000000-0000-0000-0000-000000000000')->assertStatus(404);
    }

    // ── CSRF و مهمان ────────────────────────────────────────────────────

    public function test_a_guest_cannot_list_or_write_bookmarks(): void
    {
        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'guest-guard']);
        $csrf = $student['csrf'];

        $this->forgetCookies();

        $this->getJson(self::BOOKMARKS)->assertStatus(401);
        $this->add($csrf, $article->getKey())->assertStatus(401);

        $this->assertSame(0, WikiBookmark::query()->count());
    }

    public function test_a_bookmark_write_without_a_csrf_token_is_rejected(): void
    {
        $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'csrf-guard']);

        $this->putJson(self::BOOKMARKS.'/'.$article->getKey(), [], ['Origin' => $this->origin()])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'CSRF_FAILED');
    }

    // ── رخدادهای دامنه ──────────────────────────────────────────────────

    public function test_domain_events_are_dispatched_for_bookmarks(): void
    {
        Event::fake([WikiBookmarkAdded::class, WikiBookmarkRemoved::class]);

        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'events']);

        $this->add($student['csrf'], $article->getKey())->assertStatus(201);
        $this->remove($student['csrf'], $article->getKey())->assertNoContent();
        /* حذف دوباره: چیزی برای حذف نبود ⇒ رخداد «حذف» دوباره فرستاده نمی‌شود. */
        $this->remove($student['csrf'], $article->getKey())->assertNoContent();

        Event::assertDispatchedTimes(WikiBookmarkAdded::class, 1);
        Event::assertDispatchedTimes(WikiBookmarkRemoved::class, 1);
    }

    public function test_opening_an_article_dispatches_wiki_article_opened_only(): void
    {
        Event::fake([WikiArticleOpened::class]);

        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'opened-event']);

        $this->getJson('/api/v1/wiki/articles/'.$article->slug)->assertOk();

        Event::assertDispatchedTimes(WikiArticleOpened::class, 1);
        Event::assertDispatched(
            WikiArticleOpened::class,
            fn (WikiArticleOpened $event): bool => $event->articleId === $article->getKey()
                && $event->userId === $student['user']->getKey()
                && $event->slug === 'opened-event',
        );
    }

    public function test_bookmarks_are_removed_with_the_user(): void
    {
        $student = $this->signedInStudent();
        $article = $this->makePublishedArticle(['slug' => 'cascade']);

        $this->add($student['csrf'], $article->getKey())->assertStatus(201);
        $this->assertSame(1, WikiBookmark::query()->count());

        $student['user']->delete();

        $this->assertSame(0, WikiBookmark::query()->count());
    }

    public function test_there_is_no_route_to_read_another_users_bookmarks(): void
    {
        $victim = User::factory()->create();
        $this->signedInStudent();

        $uris = array_map(
            static fn ($route): string => (string) $route->uri(),
            app('router')->getRoutes()->getRoutes(),
        );

        foreach ($uris as $uri) {
            /*
             * `admin/` استثناست: `/api/v1/admin/users/{id}` مسیر **پنل** است، زیر
             * RBAC و با Resource بدون ستون حساس (فاز ۲۰)؛ همان چیزی که این
             * محافظ می‌خواهد جلوی آن را بگیرد نیست. ممنوعیت روی مسیر کاربری است.
             */
            if (str_starts_with($uri, 'api/v1/admin/')) {
                continue;
            }

            $this->assertStringNotContainsString('users/{', $uri);
            $this->assertStringNotContainsString($victim->getKey(), $uri);
        }
    }
}
