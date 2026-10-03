<?php

namespace Tests\Feature\Knowledge;

use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\BuildsKnowledge;
use Tests\TestCase;

/**
 * کارایی پیمایش گراف — فاز ۱۲ (§36 پرامپت).
 *
 * سنجه‌های قفل‌شده:
 *   • **بدون N+1**: تعداد کوئری تابع «عمق» است نه اندازهٔ گراف. برای گراف
 *     ریشه‌دار با عمق d انتظار: ۱ (ریشه) + 2d (یال/همسایه‌های هر سطح) +
 *     ۲ (نودها + eager مقاله) — یعنی depth=3 ⇒ حداکثر ۹ کوئری، با هر تعداد نود.
 *   • **زمان**: سقف سخاوتمندانه برای CI کند؛ مقادیر اندازه‌گیری‌شدهٔ واقعی در
 *     `backend/docs/phase12-report.md` (جدول §36) آمده است.
 */
class KnowledgePerformanceTest extends TestCase
{
    use BuildsKnowledge, RefreshDatabase;

    /**
     * سناریوهای §36: ۱۰/۵۰/۱۰۰/۲۰۰ نود (با یال متناسب) × depth ۱/۲/۳.
     *
     * @return array<string, array{0: int, 1: int}>
     */
    public static function graphSizes(): array
    {
        return [
            '10 nodes' => [10, 15],
            '50 nodes' => [50, 90],
            '100 nodes' => [100, 200],
            '200 nodes' => [200, 450],
        ];
    }

    #[DataProvider('graphSizes')]
    public function test_traversal_stays_bounded_in_queries_and_time_at_every_depth(int $nodes, int $edges): void
    {
        $this->seedGraph($nodes, $edges);
        $root = KnowledgeNode::query()->where('label', 'نود 1')->firstOrFail();

        foreach ([1, 2, 3] as $depth) {
            DB::enableQueryLog();
            DB::flushQueryLog();

            $started = microtime(true);
            $response = $this->getJson('/api/v1/knowledge/graph?node='.$root->getKey().'&depth='.$depth);
            $elapsedMs = (microtime(true) - $started) * 1000;
            $queryCount = count(DB::getQueryLog());
            DB::disableQueryLog();

            $response->assertOk();

            $expectedQueries = 1 /* ریشه */ + 2 * $depth /* یال + همسایه در هر سطح */ + 2 /* نودها + eager مقاله */;

            $this->assertLessThanOrEqual(
                $expectedQueries,
                $queryCount,
                "N+1 detected at depth={$depth} ({$queryCount} > {$expectedQueries} queries)",
            );
            $this->assertLessThan(
                1500.0,
                $elapsedMs,
                "traversal too slow at depth={$depth} ({$elapsedMs}ms)",
            );
        }
    }

    public function test_whole_graph_mode_is_two_queries_regardless_of_size(): void
    {
        $this->seedGraph(200, 450);

        DB::enableQueryLog();
        DB::flushQueryLog();

        $started = microtime(true);
        $response = $this->getJson('/api/v1/knowledge/graph');
        $elapsedMs = (microtime(true) - $started) * 1000;
        $queryCount = count(DB::getQueryLog());
        DB::disableQueryLog();

        $response->assertOk();

        // ۱ نودها + ۱ یال‌ها (کش در حالت بدون پارامتر هم می‌تواند کوئری نسخه را بخواند — سقف سخاوتمندانه).
        $this->assertLessThanOrEqual(4, $queryCount, "N+1 in whole-graph mode ({$queryCount} queries)");
        $this->assertLessThan(1500.0, $elapsedMs, "whole graph too slow ({$elapsedMs}ms)");
    }

    public function test_the_graph_caps_are_enforced_on_a_large_dataset(): void
    {
        $this->seedGraph(200, 450);

        // سقف پیکربندی پیش‌فرض: ۲۰۰ نود / ۵۰۰ یال — کل گراف جا می‌شود.
        $response = $this->getJson('/api/v1/knowledge/graph');
        $response->assertOk();
        $this->assertLessThanOrEqual(200, count($response->json('data.nodes')));
        $this->assertLessThanOrEqual(500, count($response->json('data.edges')));
    }

    /**
     * ساخت گراف همبند خطی-درختی: نود i به نودهای i+1 و i+2 وصل است ⇒ عمق ۳
     * واقعاً چند سطح را می‌پیماید و یال‌ها یکنواخت پخش‌اند.
     */
    private function seedGraph(int $nodes, int $edges): void
    {
        $ids = [];

        for ($i = 1; $i <= $nodes; $i++) {
            $ids[$i] = $this->makePublishedNode(['label' => 'نود '.$i])->getKey();
        }

        $relations = ['part_of', 'causes', 'related_to', 'produces', 'regulates'];

        $created = 0;

        for ($i = 1; $i < $nodes && $created < $edges; $i++) {
            foreach ([$i + 1, $i + 2] as $offset) {
                if ($created >= $edges || $offset > $nodes) {
                    continue;
                }

                $edge = new KnowledgeEdge;
                $edge->forceFill([
                    'from_node_id' => $ids[$i],
                    'to_node_id' => $ids[$offset],
                    'relation_type' => $relations[$created % count($relations)],
                ])->save();
                $created++;
            }
        }
    }
}
