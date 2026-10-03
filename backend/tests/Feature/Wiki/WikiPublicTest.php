<?php

namespace Tests\Feature\Wiki;

use App\Models\WikiArticle;
use App\Models\WikiCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsWiki;
use Tests\TestCase;

/**
 * ویکی — سطح عمومی (فاز ۱۰).
 *
 * قاعدهٔ مرکزی: **فقط `published` دیده می‌شود.** `draft` و `archived` در هیچ
 * مسیری — فهرست، جزئیات، جست‌وجو، پیشنهاد، facet — ظاهر نمی‌شوند و شناسه/ slug
 * آن‌ها ۴۰۴ می‌گیرد، نه ۴۰۳ (وجودشان لو نمی‌رود).
 *
 * و قاعدهٔ دوم: متادیتای نویسنده هرگز از مسیر عمومی بیرون نمی‌رود.
 */
class WikiPublicTest extends TestCase
{
    use BuildsWiki, RefreshDatabase;

    // ── دسته‌بندی ───────────────────────────────────────────────────────

    public function test_the_category_tree_only_contains_published_categories(): void
    {
        $published = $this->makeCategory(['slug' => 'anatomy', 'status' => WikiCategory::STATUS_PUBLISHED]);
        $draft = $this->makeCategory(['slug' => 'draft-cat']);
        $archived = $this->makeCategory(['slug' => 'old-cat', 'status' => WikiCategory::STATUS_ARCHIVED]);

        $slugs = array_column($this->getJson('/api/v1/wiki/categories')->assertOk()->json('data.categories'), 'slug');

        $this->assertSame([$published->slug], $slugs);
        $this->assertNotContains($draft->slug, $slugs);
        $this->assertNotContains($archived->slug, $slugs);
    }

    public function test_the_category_tree_is_nested_and_counts_only_published_articles(): void
    {
        $parent = $this->makeCategory(['slug' => 'physiology', 'status' => WikiCategory::STATUS_PUBLISHED]);
        $child = $this->makeCategory([
            'slug' => 'kidney',
            'parent_id' => $parent->getKey(),
            'status' => WikiCategory::STATUS_PUBLISHED,
        ]);

        $this->makePublishedArticle(['slug' => 'nephron'], null, $child);
        $this->makeArticle(['slug' => 'unpublished-note'], null, $child);

        $categories = $this->getJson('/api/v1/wiki/categories')->assertOk()->json('data.categories');

        $this->assertCount(1, $categories);
        $this->assertSame('physiology', $categories[0]['slug']);
        $this->assertCount(1, $categories[0]['children']);
        $this->assertSame('kidney', $categories[0]['children'][0]['slug']);
        $this->assertSame(1, $categories[0]['children'][0]['articles_count']);
    }

    // ── فهرست مقاله ─────────────────────────────────────────────────────

    public function test_the_article_list_only_returns_published_articles(): void
    {
        $published = $this->makePublishedArticle(['slug' => 'published-one']);
        $draft = $this->makeArticle(['slug' => 'draft-one']);
        $archived = $this->makeArticle(['slug' => 'archived-one', 'status' => WikiArticle::STATUS_ARCHIVED]);

        $slugs = array_column($this->getJson('/api/v1/wiki/articles')->assertOk()->json('data.articles'), 'slug');

        $this->assertContains($published->slug, $slugs);
        $this->assertNotContains($draft->slug, $slugs);
        $this->assertNotContains($archived->slug, $slugs);
    }

    public function test_the_article_list_is_paginated_and_filters_actually_apply(): void
    {
        $this->makePublishedArticle(['slug' => 'a-1', 'subject' => 'physiology', 'content_type' => 'concept']);
        $this->makePublishedArticle(['slug' => 'a-2', 'subject' => 'pharmacology', 'content_type' => 'drug']);
        $this->makePublishedArticle(['slug' => 'a-3', 'subject' => 'physiology', 'content_type' => 'concept']);

        $response = $this->getJson('/api/v1/wiki/articles?subject=physiology&perPage=1')->assertOk();

        $this->assertSame(2, $response->json('meta.total'));
        $this->assertSame(2, $response->json('meta.lastPage'));
        $this->assertCount(1, $response->json('data.articles'));

        /* ترتیب پیش‌فرض بر اساس محبوبیت است، پس روی «مجموعه» تأکید می‌کنیم. */
        $slugs = array_column(
            $this->getJson('/api/v1/wiki/articles?subject=physiology')->assertOk()->json('data.articles'),
            'slug',
        );

        sort($slugs);
        $this->assertSame(['a-1', 'a-3'], $slugs);

        $byType = $this->getJson('/api/v1/wiki/articles?type=drug')->assertOk();
        $this->assertSame(1, $byType->json('meta.total'));
        $this->assertSame('a-2', $byType->json('data.articles.0.slug'));
    }

    public function test_the_status_filter_is_not_accepted_on_the_public_list(): void
    {
        $this->makeArticle(['slug' => 'draft-one']);

        /*
         * ۴۰۰ (پارامتر ناشناخته) و نه نادیده‌گرفتن بی‌صدا: اگر `status` پذیرفته
         * شود، کلاینت فکر می‌کند پیش‌نویس‌ها را دیده است.
         */
        $this->getJson('/api/v1/wiki/articles?status=draft')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    public function test_per_page_above_the_ceiling_is_rejected(): void
    {
        $max = (int) config('wiki.pagination.max_per_page');

        $this->getJson('/api/v1/wiki/articles?perPage='.($max + 1))
            ->assertStatus(422)
            ->assertFieldError('perPage');
    }

    public function test_an_invalid_sort_is_rejected(): void
    {
        $this->getJson('/api/v1/wiki/articles?sort=random')
            ->assertStatus(422)
            ->assertFieldError('sort');
    }

    // ── جزئیات مقاله ────────────────────────────────────────────────────

    public function test_a_published_article_is_readable_by_slug(): void
    {
        $article = $this->makePublishedArticle(['slug' => 'kidney-function', 'title' => 'عملکرد کلیه']);

        $response = $this->getJson('/api/v1/wiki/articles/'.$article->slug)->assertOk();

        $this->assertSame('عملکرد کلیه', $response->json('data.article.title'));
        $this->assertSame([], $response->json('data.related'));
        $this->assertSame([], $response->json('data.backlinks'));
    }

    public function test_a_draft_or_archived_article_is_a_404(): void
    {
        $draft = $this->makeArticle(['slug' => 'draft-article']);
        $archived = $this->makeArticle(['slug' => 'archived-article', 'status' => WikiArticle::STATUS_ARCHIVED]);

        $this->getJson('/api/v1/wiki/articles/'.$draft->slug)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->getJson('/api/v1/wiki/articles/'.$archived->slug)->assertStatus(404);
        $this->getJson('/api/v1/wiki/articles/no-such-article')->assertStatus(404);
    }

    public function test_the_public_article_never_exposes_author_metadata_or_internal_state(): void
    {
        $article = $this->makePublishedArticle(['slug' => 'leak-check']);

        $payload = $this->getJson('/api/v1/wiki/articles/'.$article->slug)->assertOk()->json('data.article');

        foreach (['author_admin_id', 'editor_admin_id', 'legacy_id', 'status', 'version', 'view_count'] as $forbidden) {
            $this->assertArrayNotHasKey($forbidden, $payload, "public article must not expose {$forbidden}");
        }

        $summary = $this->getJson('/api/v1/wiki/articles')->assertOk()->json('data.articles.0');

        foreach (['author_admin_id', 'editor_admin_id', 'legacy_id', 'status', 'version', 'body'] as $forbidden) {
            $this->assertArrayNotHasKey($forbidden, $summary, "public summary must not expose {$forbidden}");
        }
    }

    public function test_opening_an_article_counts_a_view_without_exposing_the_counter(): void
    {
        $article = $this->makePublishedArticle(['slug' => 'viewed']);

        $this->getJson('/api/v1/wiki/articles/viewed')->assertOk();
        $this->getJson('/api/v1/wiki/articles/viewed')->assertOk();

        $this->assertSame(2, (int) WikiArticle::query()->findOrFail($article->getKey())->view_count);
    }

    public function test_relations_only_expose_published_articles_on_both_ends(): void
    {
        $source = $this->makePublishedArticle(['slug' => 'source']);
        $publishedTarget = $this->makePublishedArticle(['slug' => 'published-target']);
        $draftTarget = $this->makeArticle(['slug' => 'draft-target']);
        $draftSource = $this->makeArticle(['slug' => 'draft-source']);

        $this->makeRelation($source, $publishedTarget, ['kind' => 'regulates']);
        $this->makeRelation($source, $draftTarget, ['kind' => 'causes']);
        $this->makeRelation($draftSource, $source, ['kind' => 'part_of']);

        $response = $this->getJson('/api/v1/wiki/articles/source')->assertOk();

        $relatedSlugs = array_column($response->json('data.related'), 'slug');
        $backlinkSlugs = array_column($response->json('data.backlinks'), 'slug');

        $this->assertSame(['published-target'], $relatedSlugs);
        $this->assertSame([], $backlinkSlugs);
        $this->assertSame('regulates', $response->json('data.related.0.kind'));
        $this->assertSame('outgoing', $response->json('data.related.0.direction'));
    }

    public function test_a_published_backlink_is_listed_as_incoming(): void
    {
        $source = $this->makePublishedArticle(['slug' => 'source']);
        $other = $this->makePublishedArticle(['slug' => 'other']);
        $this->makeRelation($other, $source, ['kind' => 'treated_by']);

        $response = $this->getJson('/api/v1/wiki/articles/source')->assertOk();

        $this->assertSame([], $response->json('data.related'));
        $this->assertSame('other', $response->json('data.backlinks.0.slug'));
        $this->assertSame('incoming', $response->json('data.backlinks.0.direction'));
    }

    // ── جست‌وجو ─────────────────────────────────────────────────────────

    public function test_search_only_returns_published_articles(): void
    {
        $match = $this->makePublishedArticle(['slug' => 'kidney', 'title' => 'بیماری کلیه']);
        $draft = $this->makeArticle(['slug' => 'kidney-draft', 'title' => 'بیماری کلیه پیش‌نویس']);

        $slugs = array_column(
            $this->getJson('/api/v1/wiki/search?q='.rawurlencode('کلیه'))->assertOk()->json('data.results'),
            'slug',
        );

        $this->assertContains($match->slug, $slugs);
        $this->assertNotContains($draft->slug, $slugs);
    }

    public function test_search_normalises_arabic_letters_so_the_user_finds_persian_content(): void
    {
        $article = $this->makePublishedArticle(['slug' => 'koliye', 'title' => 'بیماری کلیه']);

        /* «كليه» با کاف و ی عربی تایپ شده. */
        $slugs = array_column(
            $this->getJson('/api/v1/wiki/search?q='.rawurlencode('كليه'))->assertOk()->json('data.results'),
            'slug',
        );

        $this->assertSame([$article->slug], $slugs);
    }

    public function test_search_requires_a_query_and_a_minimum_length(): void
    {
        $this->getJson('/api/v1/wiki/search')->assertStatus(422)->assertFieldError('q');
        $this->getJson('/api/v1/wiki/search?q=a')->assertStatus(422)->assertFieldError('q');
    }

    public function test_search_facets_are_computed_on_the_filtered_set(): void
    {
        $this->makePublishedArticle(['slug' => 'p-1', 'subject' => 'physiology', 'content_type' => 'concept', 'difficulty' => 'basic']);
        $this->makePublishedArticle(['slug' => 'p-2', 'subject' => 'physiology', 'content_type' => 'disease', 'difficulty' => 'advanced']);
        $this->makePublishedArticle(['slug' => 'p-3', 'subject' => 'pharmacology', 'content_type' => 'drug', 'difficulty' => 'basic']);

        $facets = $this->getJson('/api/v1/wiki/search?q='.rawurlencode('مقاله').'&subject=physiology')
            ->assertOk()
            ->json('data.facets');

        $this->assertSame(['physiology' => 2], $facets['bySubject']);
        $this->assertSame(['concept' => 1, 'disease' => 1], $facets['byType']);

        /* ترتیب کلیدهای facet از `group by` می‌آید، پس روی مقدار تأکید می‌کنیم. */
        $difficulty = $facets['byDifficulty'];
        ksort($difficulty);
        $this->assertSame(['advanced' => 1, 'basic' => 1], $difficulty);
    }

    public function test_a_search_wildcard_from_the_client_does_not_become_a_wildcard(): void
    {
        $this->makePublishedArticle(['slug' => 'p-1', 'title' => 'متن']);

        $this->getJson('/api/v1/wiki/search?q=%25%25')
            ->assertOk()
            ->assertJsonCount(0, 'data.results');
    }

    public function test_search_is_paginated(): void
    {
        foreach (range(1, 5) as $index) {
            $this->makePublishedArticle(['slug' => 'page-'.$index, 'title' => 'متن مشترک '.$index]);
        }

        $response = $this->getJson('/api/v1/wiki/search?q='.rawurlencode('مشترک').'&perPage=2')->assertOk();

        $this->assertCount(2, $response->json('data.results'));
        $this->assertSame(5, $response->json('meta.total'));
        $this->assertSame(3, $response->json('meta.lastPage'));
    }

    // ── پیشنهاد ─────────────────────────────────────────────────────────

    public function test_suggest_is_bounded_and_only_returns_published_titles(): void
    {
        foreach (range(1, 3) as $index) {
            $this->makePublishedArticle(['slug' => 'sug-'.$index, 'title' => 'کلیه '.$index]);
        }

        $draft = $this->makeArticle(['slug' => 'sug-draft', 'title' => 'کلیه پیش‌نویس']);

        $response = $this->getJson('/api/v1/wiki/suggest?q='.rawurlencode('کلیه').'&limit=20')->assertOk();

        $this->assertCount(3, $response->json('data.suggestions'));
        $this->assertSame('کلیه', $response->json('data.query'));

        $slugs = array_column($response->json('data.suggestions'), 'slug');

        $this->assertNotContains($draft->slug, $slugs);
        $this->assertNotContains('sug-draft', $slugs);

        foreach ($response->json('data.suggestions') as $suggestion) {
            $this->assertArrayNotHasKey('body', $suggestion);
            $this->assertStringStartsWith('sug-', (string) $suggestion['slug']);
        }
    }

    public function test_suggest_respects_the_requested_limit(): void
    {
        foreach (range(1, 12) as $index) {
            $this->makePublishedArticle(['slug' => 'many-'.$index, 'title' => 'کلیه '.$index]);
        }

        $response = $this->getJson('/api/v1/wiki/suggest?q='.rawurlencode('کلیه').'&limit=5')->assertOk();

        $this->assertCount(5, $response->json('data.suggestions'));
    }

    public function test_the_suggest_limit_is_capped(): void
    {
        $max = (int) config('wiki.search.suggest_limit_max');

        $this->getJson('/api/v1/wiki/suggest?q='.rawurlencode('کلیه').'&limit='.($max + 1))
            ->assertStatus(422)
            ->assertFieldError('limit');
    }

    public function test_a_too_short_suggest_query_is_rejected(): void
    {
        $this->getJson('/api/v1/wiki/suggest?q=a')
            ->assertStatus(422)
            ->assertFieldError('q');
    }

    public function test_an_unknown_suggest_parameter_is_rejected(): void
    {
        $this->getJson('/api/v1/wiki/suggest?q='.rawurlencode('کلیه').'&subject=x')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    // ── مهمان ───────────────────────────────────────────────────────────

    public function test_a_guest_can_read_the_public_wiki(): void
    {
        $this->makeCategory(['slug' => 'anatomy', 'status' => WikiCategory::STATUS_PUBLISHED]);
        $article = $this->makePublishedArticle(['slug' => 'guest-visible']);

        $this->forgetCookies();

        $this->getJson('/api/v1/wiki/categories')->assertOk();
        $this->getJson('/api/v1/wiki/articles')->assertOk();
        $this->getJson('/api/v1/wiki/articles/'.$article->slug)->assertOk();
        $this->getJson('/api/v1/wiki/search?q='.rawurlencode('متن'))->assertOk();
        $this->getJson('/api/v1/wiki/suggest?q='.rawurlencode('مهمان'))->assertOk();
    }

    public function test_the_bookmark_list_requires_a_session(): void
    {
        $this->forgetCookies();

        $this->getJson('/api/v1/me/wiki-bookmarks')->assertStatus(401);
    }
}
