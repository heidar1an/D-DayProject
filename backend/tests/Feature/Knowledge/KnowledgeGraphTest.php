<?php

namespace Tests\Feature\Knowledge;

use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsKnowledge;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * گراف دانش — سطح عمومی (فاز ۱۲).
 *
 * قفل‌های اصلی:
 *   • **فقط published**: نود draft/archived ۴۰۴ است (بدون افشای وجود) و یال به
 *     آن هم در هیچ پاسخی نمی‌آید («یادیت عمومی» ممنوع).
 *   • **پیمایش کراندار و قطعی**: سقف depth/نود/یال سمت سرور است؛ cycle حلقهٔ
 *     بی‌نهایت نمی‌سازد.
 *   • **قیدهای دیتابیس**: یکتایی یال، رد self edge و یکتایی پیوند مقاله در
 *     خودِ SQLite/PG هم enforce می‌شوند، نه فقط در سرویس.
 */
class KnowledgeGraphTest extends TestCase
{
    use BuildsKnowledge, InteractsWithAdmin, RefreshDatabase;

    private const GRAPH = '/api/v1/knowledge/graph';

    private const NODES = '/api/v1/knowledge/nodes';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    public function test_the_whole_public_graph_contains_only_published_nodes(): void
    {
        $published = $this->makePublishedNode(['label' => 'دیابت', 'kind' => 'disease']);
        $this->makeNode(['label' => 'پیش‌نویس']);
        $this->makeNode(['label' => 'آرشیو', 'status' => KnowledgeNode::STATUS_ARCHIVED]);

        $response = $this->getJson(self::GRAPH);

        $response->assertOk();
        $response->assertJsonPath('meta.root', null);
        $this->assertCount(1, $response->json('data.nodes'));
        $response->assertJsonPath('data.nodes.0.label', 'دیابت');
        $response->assertJsonPath('data.nodes.0.kind', 'disease');
        $this->assertSame('published', $published->refresh()->status);
    }

    public function test_a_node_detail_exposes_only_the_public_contract(): void
    {
        $article = $this->makeWikiArticleForNode(['slug' => 'e-coli', 'title' => 'E. coli']);
        $node = $this->makePublishedNode(['label' => 'E.coli', 'kind' => 'microorganism'], $article);

        $response = $this->getJson(self::NODES.'/'.$node->getKey());

        $response->assertOk();
        $response->assertJsonPath('data.node.label', 'E.coli');
        $response->assertJsonPath('data.node.kind', 'microorganism');
        $response->assertJsonPath('data.node.article.slug', 'e-coli');
        $response->assertJsonPath('data.node.article.title', 'E. coli');
        // متادیتای داخلی هرگز افشا نمی‌شود.
        $response->assertJsonMissing(['status' => 'published']);
        $this->assertStringNotContainsString('wiki_article_id', (string) $response->getContent());
    }

    public function test_a_node_without_a_linked_article_has_null_article_reference(): void
    {
        $node = $this->makePublishedNode(['label' => 'LPS']);

        $response = $this->getJson(self::NODES.'/'.$node->getKey());

        $response->assertOk()->assertJsonPath('data.node.article', null);
    }

    public function test_a_draft_or_archived_node_is_a_404_and_not_a_403(): void
    {
        $draft = $this->makeNode(['label' => 'پیش‌نویس']);
        $archived = $this->makeNode(['label' => 'آرشیو', 'status' => KnowledgeNode::STATUS_ARCHIVED]);

        $this->getJson(self::NODES.'/'.$draft->getKey())->assertNotFound();
        $this->getJson(self::NODES.'/'.$archived->getKey())->assertNotFound();
        $this->getJson(self::NODES.'/'.$draft->getKey().'/neighbors')->assertNotFound();
    }

    public function test_an_unknown_node_id_is_a_404_and_a_non_uuid_never_reaches_the_database(): void
    {
        $this->getJson(self::NODES.'/not-a-uuid')->assertNotFound();
        $this->getJson(self::NODES.'/00000000-0000-0000-0000-000000000000')->assertNotFound();
    }

    public function test_a_node_can_be_resolved_by_its_published_wiki_article_slug(): void
    {
        $article = $this->makeWikiArticleForNode(['slug' => 'e-coli']);
        $this->makePublishedNode(['label' => 'E.coli'], $article);

        $response = $this->getJson(self::GRAPH.'?node=e-coli&depth=1');

        $response->assertOk();
        $response->assertJsonPath('meta.depth', 1);
        $this->assertCount(1, $response->json('data.nodes'));
    }

    public function test_a_draft_article_slug_cannot_resolve_a_node(): void
    {
        $article = $this->makeWikiArticleForNode(['slug' => 'secret-draft', 'status' => 'draft']);
        $this->makePublishedNode(['label' => 'پنهان'], $article);

        $this->getJson(self::GRAPH.'?node=secret-draft')->assertNotFound();
    }

    // ── پیمایش ──────────────────────────────────────────────────────────

    public function test_depth_one_returns_only_direct_neighbors_with_direction(): void
    {
        $root = $this->makePublishedNode(['label' => 'E.coli']);
        $causes = $this->makePublishedNode(['label' => 'UTI']);
        $parent = $this->makePublishedNode(['label' => 'Enterobacteriaceae']);
        $this->makeEdge($root, $causes, ['relation_type' => 'causes']);
        $this->makeEdge($parent, $root, ['relation_type' => 'part_of']);
        $far = $this->makePublishedNode(['label' => 'دور']);
        $this->makeEdge($causes, $far, ['relation_type' => 'associated_with']);

        $response = $this->getJson(self::GRAPH.'?node='.$root->getKey().'&depth=1');

        $response->assertOk();
        $this->assertCount(3, $response->json('data.nodes'));
        $this->assertCount(2, $response->json('data.edges'));

        $detail = $this->getJson(self::NODES.'/'.$root->getKey());
        $detail->assertOk();

        $neighbors = collect($detail->json('data.neighbors'));
        $this->assertCount(2, $neighbors);
        $this->assertSame('out', $neighbors->firstWhere('node.label', 'UTI')['relation']['direction']);
        $this->assertSame('in', $neighbors->firstWhere('node.label', 'Enterobacteriaceae')['relation']['direction']);
        $this->assertSame('causes', $neighbors->firstWhere('node.label', 'UTI')['relation']['type']);
    }

    public function test_depth_two_reaches_second_level_neighbors(): void
    {
        $a = $this->makePublishedNode(['label' => 'A']);
        $b = $this->makePublishedNode(['label' => 'B']);
        $c = $this->makePublishedNode(['label' => 'C']);
        $this->makeEdge($a, $b);
        $this->makeEdge($b, $c);

        $one = $this->getJson(self::GRAPH.'?node='.$a->getKey().'&depth=1');
        $two = $this->getJson(self::GRAPH.'?node='.$a->getKey().'&depth=2');

        $this->assertCount(2, $one->json('data.nodes'));
        $this->assertCount(3, $two->json('data.nodes'));
    }

    public function test_traversal_does_not_pass_through_unpublished_nodes(): void
    {
        $a = $this->makePublishedNode(['label' => 'A']);
        $hidden = $this->makeNode(['label' => 'HIDDEN']); // پل پیش‌نویس
        $c = $this->makePublishedNode(['label' => 'C']);
        $this->makeEdge($a, $hidden);
        $this->makeEdge($hidden, $c);

        $response = $this->getJson(self::GRAPH.'?node='.$a->getKey().'&depth=3');

        $response->assertOk();
        $labels = collect($response->json('data.nodes'))->pluck('label')->all();
        $this->assertSame(['A'], $labels);
        $this->assertCount(0, $response->json('data.edges'));
    }

    public function test_a_cycle_does_not_loop_and_keeps_the_graph_bounded(): void
    {
        $a = $this->makePublishedNode(['label' => 'A']);
        $b = $this->makePublishedNode(['label' => 'B']);
        $c = $this->makePublishedNode(['label' => 'C']);
        $this->makeEdge($a, $b);
        $this->makeEdge($b, $c);
        $this->makeEdge($c, $a); // cycle

        $response = $this->getJson(self::GRAPH.'?node='.$a->getKey().'&depth=3');

        $response->assertOk();
        $this->assertCount(3, $response->json('data.nodes'));
        $this->assertCount(3, $response->json('data.edges'));
    }

    public function test_two_relations_between_the_same_pair_are_both_kept(): void
    {
        $a = $this->makePublishedNode(['label' => 'LPS']);
        $b = $this->makePublishedNode(['label' => 'Gram-negative membrane']);
        $this->makeEdge($a, $b, ['relation_type' => 'part_of']);
        $this->makeEdge($a, $b, ['relation_type' => 'located_in']);

        $response = $this->getJson(self::GRAPH.'?node='.$a->getKey());

        $this->assertCount(2, $response->json('data.edges'));
    }

    public function test_an_isolated_published_node_appears_without_edges(): void
    {
        $this->makePublishedNode(['label' => 'جزیره']);

        $response = $this->getJson(self::GRAPH);

        $this->assertCount(1, $response->json('data.nodes'));
        $this->assertCount(0, $response->json('data.edges'));
    }

    // ── فیلترها ─────────────────────────────────────────────────────────

    public function test_kind_filter_drops_nodes_and_their_orphan_edges(): void
    {
        $drug = $this->makePublishedNode(['label' => 'متفرمین', 'kind' => 'drug']);
        $disease = $this->makePublishedNode(['label' => 'دیابت', 'kind' => 'disease']);
        $this->makeEdge($drug, $disease, ['relation_type' => 'treated_by']);

        $response = $this->getJson(self::GRAPH.'?kind=disease');

        $labels = collect($response->json('data.nodes'))->pluck('label')->all();
        $this->assertSame(['دیابت'], $labels);
        $this->assertCount(0, $response->json('data.edges')); // یال یتیم حذف شد.
    }

    public function test_relation_filter_keeps_only_matching_edges(): void
    {
        $a = $this->makePublishedNode(['label' => 'A']);
        $b = $this->makePublishedNode(['label' => 'B']);
        $this->makeEdge($a, $b, ['relation_type' => 'causes']);
        $this->makeEdge($a, $b, ['relation_type' => 'related_to']);

        $response = $this->getJson(self::GRAPH.'?relation=causes');

        $this->assertCount(1, $response->json('data.edges'));
        $response->assertJsonPath('data.edges.0.relation', 'causes');
    }

    // ── اعتبارسنجی قرارداد ──────────────────────────────────────────────

    public function test_an_unknown_query_parameter_is_rejected(): void
    {
        $this->getJson(self::GRAPH.'?status=draft')->assertStatus(400);
        $this->getJson(self::GRAPH.'?limit=999999')->assertStatus(400);
    }

    public function test_depth_overflow_is_a_validation_error_not_a_traversal(): void
    {
        $this->getJson(self::GRAPH.'?depth=999999')->assertStatus(422);
        $this->getJson(self::GRAPH.'?depth=-1')->assertStatus(422);
    }

    public function test_an_unknown_kind_is_a_validation_error(): void
    {
        $this->getJson(self::GRAPH.'?kind=galaxy')->assertFieldError('kind');
    }

    public function test_depth_above_the_server_cap_never_expands_beyond_the_cap(): void
    {
        $a = $this->makePublishedNode(['label' => 'A']);
        $b = $this->makePublishedNode(['label' => 'B']);
        $this->makeEdge($a, $b);

        // depth=2 در سقف سرور مجاز است (maxDepth=3) — پاسخ همچنان کراندار.
        $response = $this->getJson(self::GRAPH.'?node='.$a->getKey().'&depth=2');

        $response->assertOk();
        $this->assertCount(2, $response->json('data.nodes'));
    }

    // ── قیدهای دیتابیس (نه فقط سرویس) ───────────────────────────────────

    public function test_the_database_itself_refuses_a_duplicate_edge(): void
    {
        $a = $this->makePublishedNode();
        $b = $this->makePublishedNode();
        $this->makeEdge($a, $b, ['relation_type' => 'causes']);

        $this->expectException(QueryException::class);

        $this->makeEdge($a, $b, ['relation_type' => 'causes']);
    }

    public function test_the_database_itself_refuses_a_self_edge(): void
    {
        $a = $this->makePublishedNode();

        $this->expectException(QueryException::class);

        $this->makeEdge($a, $a);
    }

    public function test_the_database_refuses_an_edge_to_a_missing_node(): void
    {
        $a = $this->makePublishedNode();

        $edge = new KnowledgeEdge;
        $edge->forceFill([
            'from_node_id' => $a->getKey(),
            'to_node_id' => (string) Str::uuid(), // موجود نیست — FK باید بشکند.
            'relation_type' => 'related_to',
        ]);

        $this->expectException(QueryException::class);

        $edge->save();
    }

    public function test_the_database_itself_refuses_a_second_node_for_the_same_article(): void
    {
        $article = $this->makeWikiArticleForNode();
        $this->makePublishedNode([], $article);

        $this->expectException(QueryException::class);

        $this->makeNode([], $article);
    }

    public function test_deleting_a_linked_article_is_blocked_at_the_database_level(): void
    {
        $article = $this->makeWikiArticleForNode();
        $this->makePublishedNode([], $article);

        $this->expectException(QueryException::class);

        $article->delete(); // §39: نود یتیمِ مخفی ساخته نمی‌شود — حذف مسدود است.
    }

    // ── کش و واژه‌نامه ──────────────────────────────────────────────────

    public function test_the_graph_cache_is_invalidated_when_a_node_is_published(): void
    {
        $node = $this->makeNode(['label' => 'تازه']);

        $before = $this->getJson(self::GRAPH);
        $this->assertCount(0, $before->json('data.nodes'));

        // انتشار از API پنل — bump نسخهٔ کش باید گراف تازه بدهد.
        $this->actingAsAdmin($this->makeAdmin('editor'));
        $this->postJsonWithOrigin('/api/v1/admin/knowledge/nodes/'.$node->getKey().'/publish', [], $this->adminCsrf())
            ->assertOk();

        $after = $this->getJson(self::GRAPH);
        $this->assertCount(1, $after->json('data.nodes'));
        $after->assertJsonPath('data.nodes.0.label', 'تازه');
    }

    public function test_edges_are_weighted_when_provided(): void
    {
        $a = $this->makePublishedNode(['label' => 'A']);
        $b = $this->makePublishedNode(['label' => 'B']);
        $edge = $this->makeEdge($a, $b, ['relation_type' => 'causes', 'weight' => 2.5]);

        $this->assertSame(2.5, $edge->refresh()->weight);

        $response = $this->getJson(self::GRAPH.'?node='.$a->getKey());
        $response->assertJsonPath('data.edges.0.weight', 2.5);
    }

    public function test_a_guest_has_no_write_surface_on_the_public_graph(): void
    {
        $this->forgetCookies();

        foreach ([
            ['POST', self::GRAPH],
            ['DELETE', self::GRAPH],
            ['PATCH', self::GRAPH],
        ] as [$method, $uri]) {
            $response = $this->json($method, $uri);
            $this->assertContains($response->getStatusCode(), [404, 405], "{$method} {$uri} unexpectedly accepted");
        }
    }
}
