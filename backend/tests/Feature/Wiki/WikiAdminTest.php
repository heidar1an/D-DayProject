<?php

namespace Tests\Feature\Wiki;

use App\Models\Admin;
use App\Models\WikiArticle;
use App\Models\WikiCategory;
use App\Models\WikiRelation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsWiki;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * ویکی — سطح پنل (فاز ۱۰).
 *
 * قفل‌های اصلی:
 *   • **deny-by-default** با کلیدهای واقعی `articles.*` / `categories.*`.
 *   • **optimistic lock**: ویرایش مقاله بدون `version` رد می‌شود و نسخهٔ کهنه ۴۰۹.
 *   • **حفاظت چرخه** در درخت دسته‌بندی (A→B→C→A).
 *   • **مرز اعتماد**: `status`/`version`/`authorAdminId`/`viewCount` هرگز از
 *     بدنه خوانده نمی‌شوند.
 */
class WikiAdminTest extends TestCase
{
    use BuildsWiki, InteractsWithAdmin, RefreshDatabase;

    private const ARTICLES = '/api/v1/admin/wiki/articles';

    private const CATEGORIES = '/api/v1/admin/wiki/categories';

    private const RELATIONS = '/api/v1/admin/wiki/relations';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    private function actingEditor(): Admin
    {
        $editor = $this->makeAdmin('editor');

        $this->actingAsAdmin($editor);

        return $editor;
    }

    // ── deny-by-default ────────────────────────────────────────────────

    public function test_a_guest_is_rejected(): void
    {
        $this->forgetCookies();

        $this->getJson(self::ARTICLES)->assertStatus(401);
        $this->postJsonWithOrigin(self::ARTICLES, [])->assertStatus(401);
    }

    public function test_an_admin_without_any_role_is_denied_on_every_wiki_route(): void
    {
        $roleless = $this->makeRolelessAdmin();
        $this->actingAsAdmin($roleless);

        $category = $this->makeCategory();
        $article = $this->makeArticle();
        $relation = $this->makeRelation($article, $this->makeArticle());

        $this->getJson(self::ARTICLES)->assertStatus(403);
        $this->getJson(self::ARTICLES.'/'.$article->getKey())->assertStatus(403);
        $this->getJson(self::CATEGORIES)->assertStatus(403);
        $this->postJsonWithOrigin(self::ARTICLES, [], $this->adminCsrf())->assertStatus(403);
        $this->patchJsonWithOrigin(self::ARTICLES.'/'.$article->getKey(), ['version' => 1], $this->adminCsrf())->assertStatus(403);
        $this->postJsonWithOrigin(self::ARTICLES.'/'.$article->getKey().'/publish', [], $this->adminCsrf())->assertStatus(403);
        $this->postJsonWithOrigin(self::CATEGORIES, [], $this->adminCsrf())->assertStatus(403);
        $this->patchJsonWithOrigin(self::CATEGORIES.'/'.$category->getKey(), [], $this->adminCsrf())->assertStatus(403);
        $this->deleteJsonWithOrigin(self::CATEGORIES.'/'.$category->getKey(), [], $this->adminCsrf())->assertStatus(403);
        $this->postJsonWithOrigin(self::RELATIONS, [], $this->adminCsrf())->assertStatus(403);
        $this->deleteJsonWithOrigin(self::RELATIONS.'/'.$relation->getKey(), [], $this->adminCsrf())->assertStatus(403);
    }

    public function test_an_editor_cannot_delete_a_category_because_the_real_role_lacks_that_permission(): void
    {
        $this->actingEditor();

        $category = $this->makeCategory();

        $this->deleteJsonWithOrigin(self::CATEGORIES.'/'.$category->getKey(), [], $this->adminCsrf())
            ->assertStatus(403);

        $this->assertNotNull(WikiCategory::query()->find($category->getKey()));
    }

    // ── ساخت مقاله ─────────────────────────────────────────────────────

    public function test_an_editor_creates_a_draft_article_authored_by_the_session_admin(): void
    {
        $editor = $this->actingEditor();
        $category = $this->makeCategory();

        $response = $this->postJsonWithOrigin(self::ARTICLES, [
            'slug' => 'Kidney Function',
            'title' => 'عملکرد کلیه',
            'summary' => 'خلاصه',
            'body' => '<p>متن مقاله</p>',
            'categoryId' => $category->getKey(),
            'subject' => 'physiology',
            'contentType' => 'concept',
            'difficulty' => 'basic',
            'keyFacts' => ['نکتهٔ یک', 'نکتهٔ دو'],
            'keywords' => ['کلیه', 'نفرون'],
            'readMinutes' => 5,
            'status' => WikiArticle::STATUS_PUBLISHED,
            'version' => 99,
            'authorAdminId' => 'ignored',
            'viewCount' => 500,
            'popularity' => 900,
            'publishedAt' => '2030-01-01T00:00:00+00:00',
        ], $this->adminCsrf())->assertStatus(201);

        $article = WikiArticle::query()->sole();

        $this->assertSame('kidney-function', $article->slug);
        $this->assertSame(WikiArticle::STATUS_DRAFT, $article->status);
        $this->assertSame(1, (int) $article->version);
        $this->assertSame(0, (int) $article->view_count);
        $this->assertSame(0, (int) $article->popularity);
        $this->assertNull($article->published_at);
        $this->assertSame($editor->getKey(), $article->author_admin_id);
        $this->assertNull($article->editor_admin_id);
        $this->assertSame(['نکتهٔ یک', 'نکتهٔ دو'], $article->key_facts);

        $this->assertSame(WikiArticle::STATUS_DRAFT, $response->json('data.article.status'));
        $this->assertSame($editor->getKey(), $response->json('data.article.author_admin_id'));
    }

    public function test_a_duplicate_slug_is_a_409(): void
    {
        $this->actingEditor();
        $this->makeArticle(['slug' => 'taken-slug']);

        $this->postJsonWithOrigin(self::ARTICLES, [
            'slug' => 'taken-slug',
            'title' => 'دیگری',
            'body' => '<p>x</p>',
        ], $this->adminCsrf())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ARTICLE_SLUG_TAKEN');
    }

    public function test_an_unknown_category_is_rejected(): void
    {
        $this->actingEditor();

        $this->postJsonWithOrigin(self::ARTICLES, [
            'slug' => 'new-article',
            'title' => 'عنوان',
            'body' => '<p>x</p>',
            'categoryId' => '00000000-0000-0000-0000-000000000000',
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertJsonPath('error.fields.categoryId.0', 'CATEGORY_NOT_FOUND');
    }

    public function test_an_invalid_content_type_is_rejected(): void
    {
        $this->actingEditor();

        $this->postJsonWithOrigin(self::ARTICLES, [
            'slug' => 'new-article',
            'title' => 'عنوان',
            'body' => '<p>x</p>',
            'contentType' => 'poem',
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertFieldError('contentType');
    }

    // ── پاک‌سازی بدنه ───────────────────────────────────────────────────

    public function test_the_article_body_is_sanitized_before_it_is_stored(): void
    {
        $this->actingEditor();

        $this->postJsonWithOrigin(self::ARTICLES, [
            'slug' => 'xss-attempt',
            'title' => 'مقاله',
            'body' => '<p>متن</p><script>alert(1)</script><iframe src="https://evil.example"></iframe>',
            'keyFacts' => ['<b>نکته</b>'],
        ], $this->adminCsrf())->assertStatus(201);

        $article = WikiArticle::query()->sole();

        $this->assertStringContainsString('<p>متن</p>', $article->body);
        $this->assertStringNotContainsString('<script', $article->body);
        $this->assertStringNotContainsString('<iframe', $article->body);
        $this->assertSame(['نکته'], $article->key_facts);
    }

    // ── انتشار و آرشیو ─────────────────────────────────────────────────

    public function test_publishing_makes_the_article_public_and_archiving_hides_it_again(): void
    {
        $this->actingEditor();

        $article = $this->makeArticle(['slug' => 'to-publish', 'title' => 'عنوان']);

        /* پیش از انتشار: پیش‌نویس برای مهمان ۴۰۴ است. */
        $this->forgetCookies();
        $this->getJson('/api/v1/wiki/articles/to-publish')->assertStatus(404);

        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $published = $this->postJsonWithOrigin(self::ARTICLES.'/'.$article->getKey().'/publish', [], $this->adminCsrf())
            ->assertOk();

        $this->assertSame(WikiArticle::STATUS_PUBLISHED, $published->json('data.article.status'));
        $this->assertNotNull($published->json('data.article.published_at'));

        $this->forgetCookies();
        $this->getJson('/api/v1/wiki/articles/to-publish')->assertOk();

        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $this->postJsonWithOrigin(self::ARTICLES.'/'.$article->getKey().'/archive', [], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.article.status', WikiArticle::STATUS_ARCHIVED);

        $this->forgetCookies();
        $this->getJson('/api/v1/wiki/articles/to-publish')->assertStatus(404);
    }

    // ── optimistic lock ────────────────────────────────────────────────

    public function test_updating_an_article_requires_a_version(): void
    {
        $this->actingEditor();
        $article = $this->makeArticle();

        $this->patchJsonWithOrigin(self::ARTICLES.'/'.$article->getKey(), [
            'title' => 'بدون نسخه',
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertFieldError('version');
    }

    public function test_a_stale_version_is_a_409_and_the_body_is_not_overwritten(): void
    {
        $this->actingEditor();
        $article = $this->makeArticle(['slug' => 'lock-me', 'title' => 'نسخهٔ یک']);

        $this->patchJsonWithOrigin(self::ARTICLES.'/'.$article->getKey(), [
            'title' => 'نسخهٔ دو',
            'version' => 1,
        ], $this->adminCsrf())->assertOk()->assertJsonPath('data.article.version', 2);

        $this->patchJsonWithOrigin(self::ARTICLES.'/'.$article->getKey(), [
            'title' => 'بازنویسی بی‌صدا',
            'version' => 1,
        ], $this->adminCsrf())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'VERSION_CONFLICT');

        $stored = WikiArticle::query()->findOrFail($article->getKey());
        $this->assertSame('نسخهٔ دو', $stored->title);
        $this->assertSame(2, (int) $stored->version);
    }

    public function test_the_editor_admin_is_recorded_but_the_author_is_not_replaced(): void
    {
        $author = $this->makeAdmin('editor');
        $this->actingAsAdmin($author);

        $article = $this->makeArticle(['slug' => 'two-editors'], $author);

        $other = $this->makeAdmin('editor');
        $this->actingAsAdmin($other);

        $this->patchJsonWithOrigin(self::ARTICLES.'/'.$article->getKey(), [
            'summary' => 'ویرایش‌شده',
            'version' => 1,
        ], $this->adminCsrf())->assertOk();

        $stored = WikiArticle::query()->findOrFail($article->getKey());

        $this->assertSame($author->getKey(), $stored->author_admin_id);
        $this->assertSame($other->getKey(), $stored->editor_admin_id);
    }

    // ── دسته‌بندی ──────────────────────────────────────────────────────

    public function test_a_category_is_created_as_a_draft(): void
    {
        $this->actingEditor();

        $this->postJsonWithOrigin(self::CATEGORIES, [
            'slug' => 'Anatomy',
            'name' => 'آناتومی',
            'description' => 'توضیح',
            'sortOrder' => 3,
            'status' => WikiCategory::STATUS_PUBLISHED,
        ], $this->adminCsrf())->assertStatus(201);

        $category = WikiCategory::query()->sole();

        $this->assertSame('anatomy', $category->slug);
        $this->assertSame(WikiCategory::STATUS_DRAFT, $category->status);
        $this->assertSame(3, (int) $category->sort_order);
    }

    public function test_a_category_cannot_be_its_own_parent(): void
    {
        /*
         * نقش `editor` مجوز `categories.update` ندارد (آینهٔ فهرست legacy) —
         * پس همان محافظه‌کاری را می‌سنجیم: اول ۴۰۳ برای editor، بعد ۴۲۲ برای
         * نقشی که واقعاً مجوز دارد.
         */
        $this->actingEditor();
        $category = $this->makeCategory();

        $this->patchJsonWithOrigin(self::CATEGORIES.'/'.$category->getKey(), [
            'parentId' => $category->getKey(),
        ], $this->adminCsrf())->assertStatus(403);

        $this->actingAsAdmin($this->makeAdmin('admin'));

        $this->patchJsonWithOrigin(self::CATEGORIES.'/'.$category->getKey(), [
            'parentId' => $category->getKey(),
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertJsonPath('error.fields.parentId.0', 'CATEGORY_CYCLE');
    }

    public function test_a_multi_level_cycle_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('admin'));

        $a = $this->makeCategory(['slug' => 'a']);
        $b = $this->makeCategory(['slug' => 'b', 'parent_id' => $a->getKey()]);
        $c = $this->makeCategory(['slug' => 'c', 'parent_id' => $b->getKey()]);

        /* A را زیر C می‌بریم ⇒ A→B→C→A */
        $this->patchJsonWithOrigin(self::CATEGORIES.'/'.$a->getKey(), [
            'parentId' => $c->getKey(),
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertJsonPath('error.fields.parentId.0', 'CATEGORY_CYCLE');

        $this->assertNull(WikiCategory::query()->findOrFail($a->getKey())->parent_id);
    }

    public function test_the_category_depth_is_capped(): void
    {
        $this->actingEditor();

        $parent = null;

        foreach (range(1, 5) as $level) {
            $created = $this->postJsonWithOrigin(self::CATEGORIES, [
                'slug' => 'level-'.$level,
                'name' => 'سطح '.$level,
                'parentId' => $parent,
            ], $this->adminCsrf())->assertStatus(201);

            $parent = $created->json('data.category.id');
        }

        $this->postJsonWithOrigin(self::CATEGORIES, [
            'slug' => 'level-6',
            'name' => 'سطح ۶',
            'parentId' => $parent,
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CATEGORY_DEPTH_EXCEEDED');
    }

    public function test_an_unknown_parent_category_is_rejected(): void
    {
        $this->actingEditor();

        $this->postJsonWithOrigin(self::CATEGORIES, [
            'slug' => 'orphan',
            'name' => 'بی‌والد',
            'parentId' => '00000000-0000-0000-0000-000000000000',
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertJsonPath('error.fields.parentId.0', 'CATEGORY_PARENT_NOT_FOUND');
    }

    public function test_deleting_an_empty_category_removes_it(): void
    {
        $editor = $this->makeAdmin('admin');
        $this->actingAsAdmin($editor);

        $category = $this->makeCategory();

        $this->deleteJsonWithOrigin(self::CATEGORIES.'/'.$category->getKey(), [], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.outcome', 'deleted');

        $this->assertNull(WikiCategory::query()->find($category->getKey()));
    }

    public function test_deleting_a_category_with_articles_archives_it_instead(): void
    {
        $editor = $this->makeAdmin('admin');
        $this->actingAsAdmin($editor);

        $category = $this->makeCategory();
        $this->makeArticle(['slug' => 'inside'], null, $category);

        $this->deleteJsonWithOrigin(self::CATEGORIES.'/'.$category->getKey(), [], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.outcome', 'archived');

        $stored = WikiCategory::query()->findOrFail($category->getKey());

        $this->assertSame(WikiCategory::STATUS_ARCHIVED, $stored->status);
        /* مقاله دست‌نخورده مانده — حذف آبشاری وجود ندارد. */
        $this->assertSame(1, WikiArticle::query()->where('category_id', $category->getKey())->count());
    }

    public function test_deleting_a_category_with_children_archives_it(): void
    {
        $editor = $this->makeAdmin('admin');
        $this->actingAsAdmin($editor);

        $parent = $this->makeCategory(['slug' => 'parent']);
        $this->makeCategory(['slug' => 'child', 'parent_id' => $parent->getKey()]);

        $this->deleteJsonWithOrigin(self::CATEGORIES.'/'.$parent->getKey(), [], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.outcome', 'archived');
    }

    // ── رابطه ──────────────────────────────────────────────────────────

    public function test_a_relation_is_created_and_can_be_deleted(): void
    {
        $this->actingEditor();

        $from = $this->makeArticle(['slug' => 'from']);
        $to = $this->makeArticle(['slug' => 'to']);

        $created = $this->postJsonWithOrigin(self::RELATIONS, [
            'fromArticleId' => $from->getKey(),
            'toArticleId' => $to->getKey(),
            'kind' => 'regulates',
        ], $this->adminCsrf())->assertStatus(201);

        $this->assertSame('regulates', $created->json('data.relation.kind'));
        $this->assertSame('to', $created->json('data.relation.slug'));

        $this->deleteJsonWithOrigin(self::RELATIONS.'/'.$created->json('data.relation.id'), [], $this->adminCsrf())
            ->assertNoContent();

        $this->assertSame(0, WikiRelation::query()->count());
    }

    public function test_a_self_relation_is_rejected(): void
    {
        $this->actingEditor();
        $article = $this->makeArticle(['slug' => 'alone']);

        $this->postJsonWithOrigin(self::RELATIONS, [
            'fromArticleId' => $article->getKey(),
            'toArticleId' => $article->getKey(),
            'kind' => 'related_to',
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertJsonPath('error.fields.toArticleId.0', 'RELATION_SELF_NOT_ALLOWED');
    }

    public function test_a_duplicate_relation_is_a_409(): void
    {
        $this->actingEditor();

        $from = $this->makeArticle(['slug' => 'from']);
        $to = $this->makeArticle(['slug' => 'to']);
        $this->makeRelation($from, $to, ['kind' => 'causes']);

        $this->postJsonWithOrigin(self::RELATIONS, [
            'fromArticleId' => $from->getKey(),
            'toArticleId' => $to->getKey(),
            'kind' => 'causes',
        ], $this->adminCsrf())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'RELATION_EXISTS');
    }

    public function test_an_unknown_relation_kind_is_rejected(): void
    {
        $this->actingEditor();

        $from = $this->makeArticle(['slug' => 'from']);
        $to = $this->makeArticle(['slug' => 'to']);

        $this->postJsonWithOrigin(self::RELATIONS, [
            'fromArticleId' => $from->getKey(),
            'toArticleId' => $to->getKey(),
            'kind' => 'loves',
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertFieldError('kind');
    }

    public function test_a_relation_to_a_missing_article_is_rejected(): void
    {
        $this->actingEditor();
        $from = $this->makeArticle(['slug' => 'from']);

        $this->postJsonWithOrigin(self::RELATIONS, [
            'fromArticleId' => $from->getKey(),
            'toArticleId' => '00000000-0000-0000-0000-000000000000',
            'kind' => 'related_to',
        ], $this->adminCsrf())
            ->assertStatus(422)
            ->assertJsonPath('error.fields.toArticleId.0', 'ARTICLE_NOT_FOUND');
    }

    // ── فهرست پنل ──────────────────────────────────────────────────────

    public function test_the_admin_list_includes_drafts_and_archived_articles(): void
    {
        $this->actingEditor();

        $draft = $this->makeArticle(['slug' => 'draft-one']);
        $archived = $this->makeArticle(['slug' => 'archived-one', 'status' => WikiArticle::STATUS_ARCHIVED]);
        $published = $this->makePublishedArticle(['slug' => 'published-one']);

        $all = $this->getJson(self::ARTICLES)->assertOk();
        $this->assertSame(3, $all->json('meta.total'));

        $drafts = $this->getJson(self::ARTICLES.'?status=draft')->assertOk();
        $this->assertSame(1, $drafts->json('meta.total'));
        $this->assertSame($draft->slug, $drafts->json('data.articles.0.slug'));

        $this->assertSame(1, $this->getJson(self::ARTICLES.'?status=archived')->assertOk()->json('meta.total'));
        $this->assertSame(1, $this->getJson(self::ARTICLES.'?status=published')->assertOk()->json('meta.total'));
        $this->assertSame($published->slug, $this->getJson(self::ARTICLES.'?status=published')->json('data.articles.0.slug'));
        $this->assertSame($archived->slug, $this->getJson(self::ARTICLES.'?status=archived')->json('data.articles.0.slug'));
    }

    public function test_an_unknown_admin_list_parameter_is_rejected(): void
    {
        $this->actingEditor();

        $this->getJson(self::ARTICLES.'?userId=abc')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    public function test_a_missing_article_is_a_404_in_the_admin_surface(): void
    {
        $this->actingEditor();

        $this->getJson(self::ARTICLES.'/00000000-0000-0000-0000-000000000000')->assertStatus(404);
        $this->getJson(self::ARTICLES.'/not-a-uuid')->assertStatus(404);
    }

    public function test_an_admin_write_without_a_csrf_token_is_rejected(): void
    {
        $this->actingEditor();

        $this->postJson(self::CATEGORIES, ['slug' => 'x', 'name' => 'x'], ['Origin' => $this->origin()])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'CSRF_FAILED');
    }
}
