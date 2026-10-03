<?php

namespace Tests\Feature\Knowledge;

use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsKnowledge;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * گراف دانش — سطح پنل (فاز ۱۲).
 *
 * قفل‌های اصلی:
 *   • **deny-by-default** با کلیدهای واقعی `articles.*` (کلید `knowledge.*`
 *     اختراع نشد) — ادمینِ بدون نقش روی همهٔ مسیرها ۴۰۳ است.
 *   • **مرز اعتماد**: `status` هرگز از بدنه خوانده نمی‌شود؛ انتشار فقط از
 *     مسیر publish. `label` پاک‌سازی می‌شود (Stored XSS).
 *   • **دادهٔ خراب ساخته نمی‌شود**: پیوند مقالهٔ ناموجود/آرشیو، self edge،
 *     یال تکراری و یال به نود ناموجود همه رد می‌شوند.
 */
class KnowledgeAdminTest extends TestCase
{
    use BuildsKnowledge, InteractsWithAdmin, RefreshDatabase;

    private const NODES = '/api/v1/admin/knowledge/nodes';

    private const EDGES = '/api/v1/admin/knowledge/edges';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    // ── deny-by-default ────────────────────────────────────────────────

    public function test_a_guest_is_rejected(): void
    {
        $this->forgetCookies();

        $this->getJson(self::NODES)->assertStatus(401);
        $this->postJsonWithOrigin(self::NODES, [])->assertStatus(401);
        $this->postJsonWithOrigin(self::EDGES, [])->assertStatus(401);
    }

    public function test_an_admin_without_any_role_is_denied_on_every_knowledge_route(): void
    {
        $node = $this->makeNode();
        $edge = $this->makeEdge($this->makeNode(), $this->makeNode());

        $this->actingAsAdmin($this->makeRolelessAdmin());

        $this->getJson(self::NODES)->assertStatus(403);
        $this->getJson(self::NODES.'/'.$node->getKey())->assertStatus(403);
        $this->postJsonWithOrigin(self::NODES, [], $this->adminCsrf())->assertStatus(403);
        $this->patchJsonWithOrigin(self::NODES.'/'.$node->getKey(), [], $this->adminCsrf())->assertStatus(403);
        $this->postJsonWithOrigin(self::NODES.'/'.$node->getKey().'/publish', [], $this->adminCsrf())->assertStatus(403);
        $this->deleteJsonWithOrigin(self::NODES.'/'.$node->getKey(), [], $this->adminCsrf())->assertStatus(403);
        $this->postJsonWithOrigin(self::EDGES, [], $this->adminCsrf())->assertStatus(403);
        $this->deleteJsonWithOrigin(self::EDGES.'/'.$edge->getKey(), [], $this->adminCsrf())->assertStatus(403);
    }

    public function test_an_editor_cannot_delete_a_node_because_the_real_role_lacks_that_permission(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $node = $this->makeNode();

        $this->deleteJsonWithOrigin(self::NODES.'/'.$node->getKey(), [], $this->adminCsrf())
            ->assertStatus(403);

        $this->assertNotNull(KnowledgeNode::query()->find($node->getKey()));
    }

    public function test_an_admin_write_without_a_csrf_token_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->postJson(self::NODES, ['label' => 'x', 'kind' => 'concept'])->assertStatus(403);
    }

    // ── ساخت نود ────────────────────────────────────────────────────────

    public function test_an_editor_creates_a_node_that_starts_as_a_draft(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $response = $this->postJsonWithOrigin(self::NODES, [
            'label' => 'Escherichia coli',
            'kind' => 'microorganism',
        ], $this->adminCsrf());

        $response->assertCreated();
        $response->assertJsonPath('data.node.label', 'Escherichia coli');
        $response->assertJsonPath('data.node.status', 'draft');

        $this->assertSame('draft', KnowledgeNode::query()->latest('created_at')->first()?->status);
    }

    public function test_a_node_cannot_be_created_with_an_arbitrary_status_from_the_body(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        // تلاش برای mass-assignment: «status» در بدنه؛ سرویس آن را نمی‌خواند.
        $response = $this->postJsonWithOrigin(self::NODES, [
            'label' => 'هک',
            'kind' => 'concept',
            'status' => 'published',
        ], $this->adminCsrf());

        $response->assertCreated();
        $this->assertSame('draft', KnowledgeNode::query()->latest('created_at')->first()?->status);
    }

    public function test_the_node_label_is_sanitized_before_it_is_stored(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $response = $this->postJsonWithOrigin(self::NODES, [
            'label' => '<script>alert(1)</script>E.coli',
            'kind' => 'microorganism',
        ], $this->adminCsrf());

        $response->assertCreated();
        $this->assertStringNotContainsString('<script>', (string) $response->getContent());
        // sanitize فقط تگ را می‌برد؛ متنِ داخلش می‌ماند — whitelist، نه حذف کور.
        $this->assertSame('alert(1)E.coli', KnowledgeNode::query()->latest('created_at')->first()?->label);
    }

    public function test_an_unknown_kind_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->postJsonWithOrigin(self::NODES, ['label' => 'x', 'kind' => 'galaxy'], $this->adminCsrf())
            ->assertFieldError('kind');
    }

    public function test_a_missing_label_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->postJsonWithOrigin(self::NODES, ['kind' => 'concept'], $this->adminCsrf())
            ->assertFieldError('label');
    }

    public function test_a_link_to_a_missing_wiki_article_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->postJsonWithOrigin(self::NODES, [
            'label' => 'x',
            'kind' => 'concept',
            'wikiArticleId' => '00000000-0000-0000-0000-000000000000',
        ], $this->adminCsrf())->assertStatus(422)->assertJsonPath('error.code', 'WIKI_ARTICLE_NOT_FOUND');
    }

    public function test_a_link_to_an_archived_wiki_article_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $article = $this->makeWikiArticleForNode(['status' => 'archived']);

        $this->postJsonWithOrigin(self::NODES, [
            'label' => 'x',
            'kind' => 'concept',
            'wikiArticleId' => $article->getKey(),
        ], $this->adminCsrf())->assertStatus(422)->assertJsonPath('error.code', 'WIKI_ARTICLE_ARCHIVED');
    }

    public function test_a_second_node_for_the_same_article_is_a_409(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $article = $this->makeWikiArticleForNode();
        $this->makeNode([], $article);

        $this->postJsonWithOrigin(self::NODES, [
            'label' => 'دوم',
            'kind' => 'concept',
            'wikiArticleId' => $article->getKey(),
        ], $this->adminCsrf())->assertStatus(409);
    }

    // ── ویرایش/انتشار ───────────────────────────────────────────────────

    public function test_a_node_can_be_edited_and_relinked(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $node = $this->makeNode(['label' => 'قدیم']);
        $article = $this->makeWikiArticleForNode();

        $response = $this->patchJsonWithOrigin(self::NODES.'/'.$node->getKey(), [
            'label' => 'تازه',
            'kind' => 'drug',
            'wikiArticleId' => $article->getKey(),
        ], $this->adminCsrf());

        $response->assertOk();
        $response->assertJsonPath('data.node.label', 'تازه');
        $response->assertJsonPath('data.node.kind', 'drug');
        $this->assertSame($article->getKey(), $node->refresh()->wiki_article_id);
    }

    public function test_publishing_makes_the_node_public_and_archiving_hides_it_again(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $node = $this->makeNode();

        $this->postJsonWithOrigin(self::NODES.'/'.$node->getKey().'/publish', [], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.node.status', 'published');
        $this->getJson('/api/v1/knowledge/graph')->assertJsonCount(1, 'data.nodes');

        $this->postJsonWithOrigin(self::NODES.'/'.$node->getKey().'/archive', [], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.node.status', 'archived');
        $this->getJson('/api/v1/knowledge/graph')->assertJsonCount(0, 'data.nodes');
    }

    public function test_deleting_an_edgeless_node_removes_it_but_a_linked_node_is_a_409(): void
    {
        // حذف نود مجوز `articles.delete` می‌خواهد — کلید واقعی؛ editor ندارد.
        $this->actingAsAdmin($this->makeAdmin('super-admin'));

        $loose = $this->makeNode();
        $this->deleteJsonWithOrigin(self::NODES.'/'.$loose->getKey(), [], $this->adminCsrf())
            ->assertStatus(204);
        $this->assertNull(KnowledgeNode::query()->find($loose->getKey()));

        $a = $this->makeNode();
        $b = $this->makeNode();
        $edge = $this->makeEdge($a, $b);

        $this->deleteJsonWithOrigin(self::NODES.'/'.$a->getKey(), [], $this->adminCsrf())
            ->assertStatus(409);
        $this->assertNotNull(KnowledgeEdge::query()->find($edge->getKey()));
    }

    public function test_a_missing_node_is_a_404_in_the_admin_surface(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->getJson(self::NODES.'/00000000-0000-0000-0000-000000000000')->assertNotFound();
        $this->patchJsonWithOrigin(self::NODES.'/00000000-0000-0000-0000-000000000000', [], $this->adminCsrf())->assertNotFound();
    }

    // ── یال‌ها ──────────────────────────────────────────────────────────

    public function test_an_edge_is_created_and_can_be_deleted(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $from = $this->makeNode();
        $to = $this->makeNode();

        $created = $this->postJsonWithOrigin(self::EDGES, [
            'fromNodeId' => $from->getKey(),
            'toNodeId' => $to->getKey(),
            'relation' => 'causes',
            'weight' => 2.5,
        ], $this->adminCsrf());

        $created->assertCreated();
        $created->assertJsonPath('data.edge.relation', 'causes');
        $created->assertJsonPath('data.edge.weight', 2.5);
        $edgeId = (string) $created->json('data.edge.id');
        $this->assertNotSame('', $edgeId); // پنل برای حذف به id یال نیاز دارد.

        $this->deleteJsonWithOrigin(self::EDGES.'/'.$edgeId, [], $this->adminCsrf())->assertStatus(204);
        $this->assertNull(KnowledgeEdge::query()->find($edgeId));
    }

    public function test_a_duplicate_edge_is_a_409(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $from = $this->makeNode();
        $to = $this->makeNode();
        $this->makeEdge($from, $to, ['relation_type' => 'causes']);

        $this->postJsonWithOrigin(self::EDGES, [
            'fromNodeId' => $from->getKey(),
            'toNodeId' => $to->getKey(),
            'relation' => 'causes',
        ], $this->adminCsrf())->assertStatus(409);
    }

    public function test_a_self_edge_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $node = $this->makeNode();

        $this->postJsonWithOrigin(self::EDGES, [
            'fromNodeId' => $node->getKey(),
            'toNodeId' => $node->getKey(),
            'relation' => 'related_to',
        ], $this->adminCsrf())->assertFieldError('toNodeId');
    }

    public function test_an_edge_to_a_missing_node_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $from = $this->makeNode();

        $this->postJsonWithOrigin(self::EDGES, [
            'fromNodeId' => $from->getKey(),
            'toNodeId' => '00000000-0000-0000-0000-000000000000',
            'relation' => 'related_to',
        ], $this->adminCsrf())->assertStatus(422)->assertJsonPath('error.code', 'NODE_NOT_FOUND');
    }

    public function test_an_unknown_relation_kind_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->postJsonWithOrigin(self::EDGES, [
            'fromNodeId' => $this->makeNode()->getKey(),
            'toNodeId' => $this->makeNode()->getKey(),
            'relation' => 'teleports',
        ], $this->adminCsrf())->assertFieldError('relation');
    }

    public function test_an_invalid_weight_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->postJsonWithOrigin(self::EDGES, [
            'fromNodeId' => $this->makeNode()->getKey(),
            'toNodeId' => $this->makeNode()->getKey(),
            'relation' => 'related_to',
            'weight' => -2,
        ], $this->adminCsrf())->assertFieldError('weight');
    }

    // ── فهرست پنل ───────────────────────────────────────────────────────

    public function test_the_admin_list_includes_drafts_and_archived_and_supports_filters(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->makeNode(['label' => 'پیش‌نویس']);
        $this->makeNode(['label' => 'منتشر', 'status' => 'published']);
        $this->makeNode(['label' => 'آرشیو', 'status' => 'archived']);

        $all = $this->getJson(self::NODES);
        $all->assertOk();
        $this->assertCount(3, $all->json('data.nodes'));
        $this->assertSame(3, $all->json('meta.total'));

        $drafts = $this->getJson(self::NODES.'?status=draft');
        $this->assertCount(1, $drafts->json('data.nodes'));

        $byKind = $this->getJson(self::NODES.'?kind=concept');
        $this->assertCount(3, $byKind->json('data.nodes'));

        $byQuery = $this->getJson(self::NODES.'?q='.urlencode('منتشر'));
        $this->assertCount(1, $byQuery->json('data.nodes'));
    }

    public function test_an_unknown_admin_list_parameter_is_rejected(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->getJson(self::NODES.'?status=published&hacker=1')->assertStatus(400);
    }
}
