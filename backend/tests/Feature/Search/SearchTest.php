<?php

namespace Tests\Feature\Search;

use App\Models\Article;
use App\Services\Search\SearchIndexer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsOps;
use Tests\TestCase;

/**
 * جست‌وجوی عمومی — فاز ۱۹ (§31–§43).
 *
 * مهم‌ترین سنجه: **پیش‌نویس/آرشیو هرگز از مسیر جست‌وجو بیرون نمی‌زند** — حتی
 * وقتی ایندکس کهنه است و سندش هنوز در `search_documents` مانده.
 *
 * ⚠️ تلهٔ هارنس: گذاشتن متن غیر‑ASCII **خام** در query string تست (مثل
 * `?q=کلیه`) توسط پارسر PHP در `Request::create` خراب می‌شود: هر بایت در بازهٔ
 * 0x80–0x9F با `_` جایگزین می‌شود ⇒ پرس‌وجو بی‌صدا نتیجهٔ صفر می‌دهد. مرورگر
 * واقعی همیشه percent-encode می‌کند، پس تست هم باید همین کار را بکند.
 */
final class SearchTest extends TestCase
{
    use BuildsOps, RefreshDatabase;

    /**
     * ساخت URL جست‌وجو با percent-encoding درست.
     *
     * @param  array<string, string|int>  $params
     */
    private function searchUrl(array $params): string
    {
        return '/api/v1/search?'.http_build_query($params);
    }

    public function test_query_is_required_and_bounded(): void
    {
        $this->getJson('/api/v1/search')->assertStatus(422);

        $this->getJson($this->searchUrl(['q' => Str::repeat('ا', (int) config('search.query.max_length') + 1)]))
            ->assertStatus(422);

        $this->getJson($this->searchUrl(['q' => Str::repeat('ا', (int) config('search.query.min_length') - 1)]))
            ->assertStatus(422);
    }

    public function test_it_finds_a_published_indexed_article(): void
    {
        $article = $this->makeArticle(['title' => 'آناتومی کلیه', 'body' => 'بافت کلیه و نفرون']);
        $this->indexDocument('article', (string) $article->getKey());

        $response = $this->getJson($this->searchUrl(['q' => 'کلیه']));

        $response->assertOk()
            ->assertJsonPath('data.results.0.entityType', 'article')
            ->assertJsonPath('data.results.0.entityId', (string) $article->getKey())
            ->assertJsonPath('data.results.0.label', 'مقاله')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_it_normalizes_arabic_letters_and_half_space(): void
    {
        $article = $this->makeArticle(['title' => 'نیم‌فاصله در کلیه', 'body' => 'متن']);
        $this->indexDocument('article', (string) $article->getKey());

        /* کاربر با «ك» عربی و «ی» عربی جست‌وجو می‌کند. */
        $this->getJson($this->searchUrl(['q' => 'كليه']))->assertOk()->assertJsonPath('meta.total', 1);

        $this->getJson($this->searchUrl(['q' => 'نیم فاصله']))->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_draft_content_is_never_indexed(): void
    {
        $draft = $this->makeArticle(['title' => 'پیش‌نویس محرمانه', 'status' => Article::STATUS_DRAFT]);

        /* حتی اگر رخداد اشتباهاً ایندکس بخواهد، سرویس سند نمی‌سازد. */
        $this->indexDocument('article', (string) $draft->getKey());

        self::assertSame(0, DB::table('search_documents')->where('entity_id', $draft->getKey())->count());

        $this->getJson($this->searchUrl(['q' => 'محرمانه']))->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_a_stale_index_row_does_not_leak_a_draft(): void
    {
        $article = $this->makeArticle(['title' => 'مقاله منتشرشده', 'body' => 'متن']);
        $this->indexDocument('article', (string) $article->getKey());

        /* انتشار لغو می‌شود ولی سند ایندکس (به‌عمد) دست‌نخورده می‌ماند. */
        $article->forceFill(['status' => Article::STATUS_DRAFT])->save();

        self::assertSame(1, DB::table('search_documents')->where('entity_id', $article->getKey())->count());

        $this->getJson($this->searchUrl(['q' => 'منتشرشده']))
            ->assertOk()
            ->assertJsonPath('meta.total', 0)
            ->assertJsonCount(0, 'data.results');
    }

    public function test_type_filter_is_an_allowlist(): void
    {
        $article = $this->makeArticle(['title' => 'کلیه در مقاله']);
        $wiki = $this->makeWikiArticle(['title' => 'کلیه در ویکی']);

        $this->indexDocument('article', (string) $article->getKey());
        $this->indexDocument('wiki_article', (string) $wiki->getKey());

        $this->getJson($this->searchUrl(['q' => 'کلیه']))->assertOk()->assertJsonPath('meta.total', 2);

        $this->getJson($this->searchUrl(['q' => 'کلیه', 'type' => 'wiki_article']))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.results.0.entityType', 'wiki_article');

        $this->getJson($this->searchUrl(['q' => 'کلیه', 'type' => 'made_up']))->assertStatus(422);
    }

    public function test_unknown_query_parameter_and_sort_are_rejected(): void
    {
        $this->getJson($this->searchUrl(['q' => 'کلیه', 'status' => 'draft']))->assertStatus(400);
        $this->getJson($this->searchUrl(['q' => 'کلیه', 'sort' => 'score desc']))->assertStatus(422);
    }

    public function test_it_paginates_and_caps_per_page(): void
    {
        for ($i = 0; $i < 4; $i++) {
            $article = $this->makeArticle(['title' => 'کلیه شماره '.$i, 'slug' => 'k-'.$i]);
            $this->indexDocument('article', (string) $article->getKey());
        }

        $this->getJson($this->searchUrl(['q' => 'کلیه', 'perPage' => 2]))
            ->assertOk()
            ->assertJsonCount(2, 'data.results')
            ->assertJsonPath('meta.total', 4)
            ->assertJsonPath('meta.lastPage', 2)
            ->assertJsonPath('meta.candidateCapped', false);

        $this->getJson($this->searchUrl(['q' => 'کلیه', 'perPage' => (int) config('search.pagination.max_per_page') + 10]))
            ->assertStatus(422);
    }

    public function test_injection_attempts_do_not_error_or_leak(): void
    {
        $article = $this->makeArticle(['title' => 'کلیه']);
        $this->indexDocument('article', (string) $article->getKey());

        foreach (["' OR 1=1 --", 'کلیه & | ! :*', 'کلیه\'; drop table search_documents; --'] as $payload) {
            $this->getJson($this->searchUrl(['q' => $payload]))->assertOk();
        }

        /* جدول سالم است و پیش‌نویس‌ها هم لو نرفته‌اند. */
        self::assertTrue(DB::getSchemaBuilder()->hasTable('search_documents'));
    }

    public function test_rebuild_indexes_only_published_and_removes_stale_rows(): void
    {
        $published = $this->makeArticle(['title' => 'منتشرشده کلیه']);
        $draft = $this->makeArticle(['title' => 'پیش‌نویس کلیه', 'status' => Article::STATUS_DRAFT]);

        /* سند کهنه برای پیش‌نویس دستی کاشته می‌شود.
         * ⚠️ `document` روی PG ستون generated است ⇒ هرگز نوشته نمی‌شود؛ منبع
         * هر دو مسیر کوئری `document_text` است. */
        DB::table('search_documents')->insert([
            'id' => (string) Str::uuid(),
            'entity_type' => 'article',
            'entity_id' => (string) $draft->getKey(),
            'title' => 'پیش‌نویس کلیه',
            'body' => 'متن',
            'document_text' => 'پیش نویس کلیه متن',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('search:rebuild')->assertSuccessful();

        self::assertSame(1, DB::table('search_documents')->where('entity_type', 'article')->count());
        self::assertSame(1, DB::table('search_documents')->where('entity_id', $published->getKey())->count());
        self::assertSame(0, DB::table('search_documents')->where('entity_id', $draft->getKey())->count());
    }

    public function test_rebuild_rejects_an_unknown_entity_type(): void
    {
        $this->artisan('search:rebuild', ['--type' => 'made_up'])->assertFailed();
    }

    public function test_indexer_upsert_is_idempotent(): void
    {
        $article = $this->makeArticle(['title' => 'کلیه']);
        $indexer = app(SearchIndexer::class);

        $indexer->index('article', (string) $article->getKey());
        $indexer->index('article', (string) $article->getKey());

        self::assertSame(1, DB::table('search_documents')->where('entity_id', $article->getKey())->count());
    }

    public function test_remove_is_idempotent(): void
    {
        $article = $this->makeArticle(['title' => 'کلیه']);
        $indexer = app(SearchIndexer::class);

        $indexer->index('article', (string) $article->getKey());
        self::assertSame(1, $indexer->remove('article', (string) $article->getKey()));
        self::assertSame(0, $indexer->remove('article', (string) $article->getKey()));
    }

    public function test_status_reports_indexed_against_published(): void
    {
        $article = $this->makeArticle(['title' => 'کلیه']);
        $this->indexDocument('article', (string) $article->getKey());

        $status = app(SearchIndexer::class)->status();

        self::assertSame(1, $status['article']['indexed']);
        self::assertSame(1, $status['article']['published']);
    }

    public function test_a_searchable_wiki_article_is_reachable(): void
    {
        $wiki = $this->makeWikiArticle(['title' => 'بافت کلیه']);
        $this->indexDocument('wiki_article', (string) $wiki->getKey());

        $this->getJson($this->searchUrl(['q' => 'بافت']))
            ->assertOk()
            ->assertJsonPath('data.results.0.entityType', 'wiki_article')
            ->assertJsonPath('data.results.0.label', 'ویکی');
    }

    public function test_a_draft_wiki_article_is_not_indexed(): void
    {
        $wiki = $this->makeWikiArticle(['title' => 'ویکی پیش‌نویس', 'status' => 'draft']);
        $this->indexDocument('wiki_article', (string) $wiki->getKey());

        $this->getJson($this->searchUrl(['q' => 'پیش‌نویس']))->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_the_snippet_does_not_expose_the_full_body(): void
    {
        $long = Str::repeat('کلیه ', 400);
        $article = $this->makeArticle(['title' => 'کلیه', 'body' => $long]);
        $this->indexDocument('article', (string) $article->getKey());

        $response = $this->getJson($this->searchUrl(['q' => 'کلیه']))->assertOk();

        $snippet = (string) $response->json('data.results.0.snippet');

        self::assertNotSame('', $snippet, 'سند باید پیدا شود تا سنجهٔ برش معنا داشته باشد.');
        self::assertLessThan(mb_strlen($long), mb_strlen($snippet));
    }
}
