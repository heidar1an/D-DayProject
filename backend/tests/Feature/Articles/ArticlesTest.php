<?php

namespace Tests\Feature\Articles;

use App\Models\Article;
use App\Models\ArticleBookmark;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsContent;
use Tests\Concerns\BuildsWiki;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * Articles + Bookmarks — فاز ۱۶ (§24-§30/§61).
 *
 * draft در مسیر عمومی ۴۰۴ (slug enumeration بسته)، body پاک‌سازی‌شده،
 * status/author از بدنهٔ کلاینت نمی‌آیند و نشان‌گذاری idempotent است.
 */
final class ArticlesTest extends TestCase
{
    use BuildsContent, BuildsWiki, InteractsWithAdmin, RefreshDatabase;

    private ?\App\Models\Admin $admin = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    private function storeArticle(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        /** @var \App\Models\Admin $admin */
        $admin = $this->admin;

        return $this->postJsonWithOrigin('/api/v1/admin/articles', [
            'slug' => 'heart-anatomy',
            'title' => 'آناتومی قلب',
            'summary' => 'خلاصه',
            'body' => '<p>متن مقاله</p>',
            ...$overrides,
        ], $this->adminCsrf());
    }

    private function adminSession(): void
    {
        $this->admin ??= $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);
    }

    public function test_admin_creates_draft_and_body_is_sanitized(): void
    {
        $this->adminSession();

        $this->storeArticle([
            'body' => '<p>سلام</p><script>alert(1)</script><img src="x" onerror="evil()">',
        ])->assertCreated();

        $article = Article::query()->where('slug', 'heart-anatomy')->firstOrFail();

        $this->assertStringNotContainsString('<script', $article->body);
        $this->assertStringNotContainsString('onerror', $article->body);
        $this->assertStringContainsString('سلام', $article->body);
        $this->assertSame(Article::STATUS_DRAFT, $article->status);
        $this->assertSame($this->admin->getKey(), (string) $article->author_admin_id);
    }

    public function test_public_api_shows_published_only_and_drafts_404(): void
    {
        $this->adminSession();

        $this->storeArticle()->assertCreated();
        $article = Article::query()->where('slug', 'heart-anatomy')->firstOrFail();

        $this->getJson('/api/v1/articles')->assertOk()->assertJsonCount(0, 'data.articles');
        $this->getJson('/api/v1/articles/heart-anatomy')->assertNotFound();

        $this->actingAsAdmin($this->admin)
            ->postJsonWithOrigin("/api/v1/admin/articles/{$article->getKey()}/publish", [], $this->adminCsrf())
            ->assertOk();

        $this->getJson('/api/v1/articles')
            ->assertOk()
            ->assertJsonPath('data.articles.0.slug', 'heart-anatomy');

        $this->getJson('/api/v1/articles/heart-anatomy')
            ->assertOk()
            ->assertJsonPath('data.article.body', '<p>متن مقاله</p>');
    }

    public function test_status_and_author_cannot_be_mass_assigned(): void
    {
        $this->adminSession();

        $this->storeArticle([
            'status' => 'published',
            'author_admin_id' => '00000000-0000-0000-0000-000000000000',
            'published_at' => '1999-01-01T00:00:00Z',
            'version' => 77,
        ])->assertCreated();

        $article = Article::query()->where('slug', 'heart-anatomy')->firstOrFail();

        $this->assertSame(Article::STATUS_DRAFT, $article->status);
        $this->assertNull($article->published_at);
        $this->assertSame(1, (int) $article->version);
        $this->assertNotSame('00000000-0000-0000-0000-000000000000', (string) $article->author_admin_id);
    }

    public function test_version_conflict_returns_409(): void
    {
        $this->adminSession();

        $this->storeArticle()->assertCreated();
        $article = Article::query()->where('slug', 'heart-anatomy')->firstOrFail();

        $this->patchJsonWithOrigin("/api/v1/admin/articles/{$article->getKey()}", [
            'title' => 'تغییر',
            'expectedVersion' => 42,
        ], $this->adminCsrf())->assertStatus(409);
    }

    public function test_category_crud_and_filter(): void
    {
        // `categories.update/delete` فقط نقش admin دارد (آینهٔ legacy)؛ editor
        // فقط create/read دسته‌ها را دارد.
        $this->admin = $this->makeAdmin('admin');
        $this->actingAsAdmin($this->admin);

        $this->postJsonWithOrigin('/api/v1/admin/articles/categories', [
            'slug' => 'basic-sciences',
            'name' => 'علوم پایه',
        ], $this->adminCsrf())->assertCreated();

        $category = \App\Models\ArticleCategory::query()->where('slug', 'basic-sciences')->firstOrFail();

        $this->patchJsonWithOrigin("/api/v1/admin/articles/categories/{$category->getKey()}", [
            'name' => 'علوم پایهٔ پزشکی',
        ], $this->adminCsrf())->assertOk();

        $this->storeArticle(['slug' => 'categorized', 'categoryId' => $category->getKey()])->assertCreated();

        $article = Article::query()->where('slug', 'categorized')->firstOrFail();
        $this->actingAsAdmin($this->admin)
            ->postJsonWithOrigin("/api/v1/admin/articles/{$article->getKey()}/publish", [], $this->adminCsrf())
            ->assertOk();

        $this->getJson('/api/v1/articles/categories')
            ->assertOk()
            ->assertJsonPath('data.categories.0.articlesCount', 1);

        $this->getJson('/api/v1/articles?category=basic-sciences')
            ->assertOk()
            ->assertJsonCount(1, 'data.articles');
    }

    public function test_bookmarks_are_idempotent_and_scoped_to_published(): void
    {
        $this->adminSession();
        $this->storeArticle()->assertCreated();
        $article = Article::query()->where('slug', 'heart-anatomy')->firstOrFail();

        $student = $this->signedInStudent();

        // draft نشان‌گذاری نمی‌شود — ۴۰۴ (وجودش لو نمی‌رود).
        $this->putJsonWithOrigin("/api/v1/me/article-bookmarks/{$article->getKey()}", [], $student['csrf'])
            ->assertNotFound();

        $this->actingAsAdmin($this->admin)
            ->postJsonWithOrigin("/api/v1/admin/articles/{$article->getKey()}/publish", [], $this->adminCsrf())
            ->assertOk();

        // ورود ادمین سشنِ همراهِ کوکی را rotate (باطل) می‌کند؛ دانشجو باید دوباره
        // از مسیر واقعی login وارد شود و کوکی‌های سشن تازه بسته شوند.
        $login = $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09123456789',
            'password' => 'Tapesh#1402',
        ])->assertOk();
        $this->withAuthCookies($login);
        $student = ['csrf' => $this->csrfHeader($login)];

        $this->putJsonWithOrigin("/api/v1/me/article-bookmarks/{$article->getKey()}", [], $student['csrf'])
            ->assertCreated();

        // تکرار همان نشان — idempotent، رکورد تازه نمی‌سازد.
        $this->putJsonWithOrigin("/api/v1/me/article-bookmarks/{$article->getKey()}", [], $student['csrf'])
            ->assertOk();

        $this->assertSame(1, ArticleBookmark::query()->count());

        $this->getJson('/api/v1/me/article-bookmarks')
            ->assertOk()
            ->assertJsonCount(1, 'data.bookmarks')
            ->assertJsonPath('data.bookmarks.0.article.slug', 'heart-anatomy');

        $this->deleteJsonWithOrigin("/api/v1/me/article-bookmarks/{$article->getKey()}", [], $student['csrf'])
            ->assertNoContent();

        $this->deleteJsonWithOrigin("/api/v1/me/article-bookmarks/{$article->getKey()}", [], $student['csrf'])
            ->assertNoContent();

        $this->assertSame(0, ArticleBookmark::query()->count());
    }

    public function test_bookmarks_of_other_users_are_never_listed(): void
    {
        $this->adminSession();
        $this->storeArticle()->assertCreated();
        $article = Article::query()->where('slug', 'heart-anatomy')->firstOrFail();
        $this->actingAsAdmin($this->admin)
            ->postJsonWithOrigin("/api/v1/admin/articles/{$article->getKey()}/publish", [], $this->adminCsrf())
            ->assertOk();

        $first = $this->signedInStudent(['phone' => '09111111111']);
        $this->putJsonWithOrigin("/api/v1/me/article-bookmarks/{$article->getKey()}", [], $first['csrf'])->assertCreated();

        // کاربر دوم — هیچ نشانی از نشان کاربر اول نمی‌بیند (IDOR).
        $this->forgetCookies();
        $second = $this->signedInStudent(['phone' => '09222222222']);

        $this->getJson('/api/v1/me/article-bookmarks')
            ->assertOk()
            ->assertJsonCount(0, 'data.bookmarks');
    }

    public function test_roleless_admin_cannot_manage_articles(): void
    {
        $this->admin = $this->makeRolelessAdmin();
        $this->actingAsAdmin($this->admin);

        $this->storeArticle()->assertForbidden();
    }
}
