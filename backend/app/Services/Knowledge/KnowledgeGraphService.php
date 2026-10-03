<?php

namespace App\Services\Knowledge;

use App\Exceptions\ApiErrorException;
use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use App\Models\WikiArticle;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * خواندن و پیمایش گراف دانش — فاز ۱۲. تنها خوانندهٔ `knowledge_*`.
 *
 *   GET /api/v1/knowledge/graph            → graph()
 *   GET /api/v1/knowledge/nodes/{id}       → nodeDetail()
 *   GET /api/v1/knowledge/nodes/{id}/neighbors → neighbors()
 *
 * قفل‌های اصلی:
 *   • **فقط published.** نود draft/archived و هر یالی که یک سرش غیرمنتشره است
 *     در هیچ پاسخ عمومی نمی‌آید — «یادیت عمومی» وجود ندارد (§40).
 *   • **پیمایش کراندار.** depth سمت سرور سقف دارد، تعداد نود/یال سقف دارد و
 *     BFS با «نودهای دیده‌شده» track می‌شود ⇒ cycle هیچ‌گاه حلقهٔ بی‌نهایت
 *     نمی‌سازد (§13/§20).
 *   • **بدون N+1.** تعداد کوئری تابع عمق است، نه اندازهٔ گراف (۲ کوئری برای هر
 *     سطح BFS + یک واکش نودها + یک eager مقاله) — تست کارایی این را قفل می‌کند.
 *   • **بدون recursive CTE.** برای depth ≤ 3 پیمایش سطح‌به‌سطح ساده، قابل‌پیش‌بینی
 *     و کراندارتر است (§19).
 *
 * کش: فقط پاسخ‌های عمومی و مشترک؛ کلید شامل نسخهٔ جهانی گراف + همهٔ پارامترهای
 * مؤثر است و هر mutation نسخه را بالا می‌برد (§34). هیچ دادهٔ کاربر-ویژه در
 * گراف عمومی نیست، پس کش shared امن است.
 */
class KnowledgeGraphService
{
    public const CACHE_VERSION_KEY = 'knowledge:graph:version';

    public function __construct(
        private readonly int $maxDepth,
        private readonly int $maxNodes,
        private readonly int $maxEdges,
        private readonly int $ttlSeconds,
    ) {}

    /** @return static */
    public static function fromConfig(): self
    {
        return new self(
            (int) config('knowledge.graph.max_depth'),
            (int) config('knowledge.graph.max_nodes'),
            (int) config('knowledge.graph.max_edges'),
            (int) config('knowledge.cache.ttl_seconds'),
        );
    }

    /** هر mutation گراف این را صدا می‌زند ⇒ کش کلید جدید می‌گیرد. */
    public static function bumpCacheVersion(): void
    {
        Cache::forever(self::CACHE_VERSION_KEY, ((int) Cache::get(self::CACHE_VERSION_KEY, 1)) + 1);
    }

    /**
     * گراف عمومی — ریشه‌دار (با `node`) یا کل گراف (بدون آن).
     *
     * `node` می‌تواند UUID نود یا **slug مقالهٔ ویکیِ** متصل باشد (مثال پرامپت:
     * `?node=e-coli`)؛ شناسایی slug فقط روی مقالهٔ منتشرشده کار می‌کند.
     *
     * @param  ?string  $kind  فیلتر نود (allowlist) — بعد از پیمایش اعمال و یال
     *                         یتیم حذف می‌شود.
     * @param  ?string  $relation  فیلتر یال (allowlist).
     * @return array{nodes: list<KnowledgeNode>, edges: list<KnowledgeEdge>, meta: array<string, mixed>}
     */
    public function graph(?string $nodeParam, ?int $depth, ?string $kind, ?string $relation): array
    {
        $depth = $this->clampDepth($depth);

        $cacheKey = sprintf(
            'knowledge:graph:v%d:%s',
            (int) Cache::get(self::CACHE_VERSION_KEY, 1),
            hash('sha256', implode('|', [(string) $nodeParam, (string) $depth, (string) $kind, (string) $relation])),
        );

        /** @var array{nodes: list<KnowledgeNode>, edges: list<KnowledgeEdge>, meta: array<string, mixed>} $cached */
        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        $result = $nodeParam === null
            ? $this->wholeGraph($kind, $relation)
            : $this->rootedGraph($nodeParam, $depth, $kind, $relation);

        Cache::put($cacheKey, $result, now()->addSeconds(max(1, $this->ttlSeconds)));

        return $result;
    }

    /** @return array{nodes: list<KnowledgeNode>, edges: list<KnowledgeEdge>, meta: array<string, mixed>} */
    public function nodeDetail(string $nodeId): array
    {
        $node = $this->publishedNode($nodeId);

        return [
            'nodes' => [$node],
            'edges' => [],
            'meta' => ['root' => $node->getKey(), 'depth' => 0],
            'neighbors' => $this->neighbors($node),
        ];
    }

    /**
     * همسایه‌های مستقیم نود — با جهت و نوع رابطه، هر دو سمت.
     *
     * @return list<array{node: KnowledgeNode, relation: array{type: string, direction: string}}>
     */
    public function neighbors(KnowledgeNode $node): array
    {
        $edges = KnowledgeEdge::query()
            ->where(function ($query) use ($node): void {
                $query->where('from_node_id', $node->getKey())
                    ->orWhere('to_node_id', $node->getKey());
            })
            ->orderBy('from_node_id')
            ->orderBy('to_node_id')
            ->orderBy('relation_type')
            ->limit($this->maxEdges)
            ->get();

        $neighborIds = [];

        foreach ($edges as $edge) {
            $neighborIds[] = $edge->from_node_id === $node->getKey()
                ? $edge->to_node_id
                : $edge->from_node_id;
        }

        if ($neighborIds === []) {
            return [];
        }

        $published = KnowledgeNode::query()
            ->whereIn('id', $neighborIds)
            ->where('status', KnowledgeNode::STATUS_PUBLISHED)
            ->with(['wikiArticle' => fn ($query) => $query->select('id', 'slug', 'title', 'status')->where('status', WikiArticle::STATUS_PUBLISHED)])
            ->get()
            ->keyBy('id');

        $neighbors = [];

        foreach ($edges as $edge) {
            $isOutgoing = $edge->from_node_id === $node->getKey();
            $neighborId = $isOutgoing ? $edge->to_node_id : $edge->from_node_id;
            $neighbor = $published->get($neighborId);

            if (! $neighbor instanceof KnowledgeNode) {
                continue; // همسایهٔ غیرمنتشره ⇒ یال هم نامرئی است.
            }

            $neighbors[] = [
                'node' => $neighbor,
                'relation' => [
                    'type' => $edge->relation_type,
                    'direction' => $isOutgoing ? 'out' : 'in',
                    'weight' => $edge->weight,
                ],
            ];
        }

        return $neighbors;
    }

    // ── پیمایش ──────────────────────────────────────────────────────────

    /** @return array{nodes: list<KnowledgeNode>, edges: list<KnowledgeEdge>, meta: array<string, mixed>} */
    private function wholeGraph(?string $kind, ?string $relation): array
    {
        $nodes = KnowledgeNode::query()
            ->where('status', KnowledgeNode::STATUS_PUBLISHED)
            ->with(['wikiArticle' => fn ($query) => $query->select('id', 'slug', 'title', 'status')->where('status', WikiArticle::STATUS_PUBLISHED)])
            ->when($kind !== null, fn ($query) => $query->where('kind', $kind))
            ->orderBy('created_at')
            ->orderBy('id')
            ->limit($this->maxNodes)
            ->get()
            ->all();

        $edges = $this->edgesBetween($nodes, $relation);

        return [
            'nodes' => $nodes,
            'edges' => $edges,
            'meta' => ['root' => null, 'depth' => null],
        ];
    }

    /**
     * BFS ریشه‌دار: هر سطح یک کوئری یال (touching frontier) + یک کوئری وضعیت
     * همسایه‌ها. نود غیرمنتشره نه همسایه می‌شود نه گذرگاه — یالِ به آن نود هم در
     * خروجی نمی‌آید.
     *
     * @return array{nodes: list<KnowledgeNode>, edges: list<KnowledgeEdge>, meta: array<string, mixed>}
     */
    private function rootedGraph(string $nodeParam, int $depth, ?string $kind, ?string $relation): array
    {
        $root = $this->publishedNode($nodeParam);

        $visited = [$root->getKey() => true];
        $edgeBag = [];
        $frontier = [$root->getKey()];

        for ($level = 0; $level < $depth && $frontier !== [] && count($visited) < $this->maxNodes; $level++) {
            $touched = KnowledgeEdge::query()
                ->where(function ($query) use ($frontier): void {
                    $query->whereIn('from_node_id', $frontier)->orWhereIn('to_node_id', $frontier);
                })
                ->orderBy('from_node_id')
                ->orderBy('to_node_id')
                ->orderBy('relation_type')
                ->limit($this->maxEdges)
                ->get();

            if ($touched->isEmpty()) {
                break;
            }

            $nextFrontier = [];

            foreach ($touched as $edge) {
                if (count($edgeBag) >= $this->maxEdges) {
                    break;
                }

                $edgeBag[$edge->getKey()] = true;

                $neighborId = in_array($edge->from_node_id, $frontier, true)
                    ? $edge->to_node_id
                    : $edge->from_node_id;

                if (isset($visited[$neighborId]) || isset($nextFrontier[$neighborId])) {
                    continue; // cycle — نود دیده‌شده هرگز دوباره گسترش نمی‌یابد.
                }

                $nextFrontier[$neighborId] = true;
            }

            if ($nextFrontier === []) {
                break;
            }

            // فقط همسایه‌های منتشرشده وارد BFS می‌شوند؛ بقیه کنار گذاشته می‌شوند.
            $candidates = KnowledgeNode::query()
                ->whereIn('id', array_keys($nextFrontier))
                ->where('status', KnowledgeNode::STATUS_PUBLISHED)
                ->orderBy('created_at')
                ->orderBy('id')
                ->pluck('id')
                ->all();

            $frontier = [];

            foreach ($candidates as $candidateId) {
                if (count($visited) >= $this->maxNodes) {
                    break;
                }

                $visited[$candidateId] = true;
                $frontier[] = $candidateId;
            }
        }

        $nodes = KnowledgeNode::query()
            ->whereIn('id', array_keys($visited))
            ->where('status', KnowledgeNode::STATUS_PUBLISHED)
            ->with(['wikiArticle' => fn ($query) => $query->select('id', 'slug', 'title', 'status')->where('status', WikiArticle::STATUS_PUBLISHED)])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->all();

        if ($kind !== null) {
            $nodes = array_values(array_filter(
                $nodes,
                fn (KnowledgeNode $node) => $node->kind === $kind,
            ));
        }

        $edges = $this->edgesBetween($nodes, $relation, array_keys($edgeBag));

        return [
            'nodes' => $nodes,
            'edges' => $edges,
            'meta' => ['root' => $root->getKey(), 'depth' => $depth],
        ];
    }

    /**
     * یال‌های بین نودهای حاضر در خروجی — «یادیت عمومی» ساخته نمی‌شود.
     *
     * @param  list<KnowledgeNode>  $nodes
     * @param  ?list<string>  $onlyIds
     * @return list<KnowledgeEdge>
     */
    private function edgesBetween(array $nodes, ?string $relation, ?array $onlyIds = null): array
    {
        if ($nodes === [] || ($onlyIds !== null && $onlyIds === [])) {
            return [];
        }

        $ids = array_map(fn (KnowledgeNode $node) => $node->getKey(), $nodes);

        $query = KnowledgeEdge::query()
            ->whereIn('from_node_id', $ids)
            ->whereIn('to_node_id', $ids)
            ->orderBy('from_node_id')
            ->orderBy('to_node_id')
            ->orderBy('relation_type')
            ->limit($this->maxEdges);

        if ($onlyIds !== null) {
            $query->whereIn('id', $onlyIds);
        }

        $edges = $query->get()->all();

        if ($relation !== null) {
            return array_values(array_filter(
                $edges,
                fn (KnowledgeEdge $edge) => $edge->relation_type === $relation,
            ));
        }

        return $edges;
    }

    // ── کمک‌ها ──────────────────────────────────────────────────────────

    private function clampDepth(?int $depth): int
    {
        $default = min((int) config('knowledge.graph.default_depth'), $this->maxDepth);

        if ($depth === null) {
            return max(0, $default);
        }

        return max(0, min($depth, $this->maxDepth));
    }

    /**
     * نود منتشرشده با UUID — UUID نامعتبر هم ۴۰۴ است، نه ۵۰۰ (تلهٔ PG 22P02).
     * وجود نود خصوصی با ۴۰۴ افشا نمی‌شود.
     */
    public function publishedNode(string $nodeParam): KnowledgeNode
    {
        $withArticle = ['wikiArticle' => fn ($query) => $query->select('id', 'slug', 'title', 'status')->where('status', WikiArticle::STATUS_PUBLISHED)];

        if (! Str::isUuid($nodeParam)) {
            // رشتهٔ غیر-UUID = slug مقالهٔ ویکیِ متصل.
            $node = KnowledgeNode::query()
                ->where('status', KnowledgeNode::STATUS_PUBLISHED)
                ->whereHas('wikiArticle', function ($query) use ($nodeParam): void {
                    $query->where('slug', $nodeParam)
                        ->where('status', WikiArticle::STATUS_PUBLISHED);
                })
                ->with($withArticle)
                ->first();

            if (! $node instanceof KnowledgeNode) {
                throw new ApiErrorException('NODE_NOT_FOUND', 404, 'Knowledge node not found.');
            }

            return $node;
        }

        $node = KnowledgeNode::query()
            ->whereKey($nodeParam)
            ->where('status', KnowledgeNode::STATUS_PUBLISHED)
            ->with($withArticle)
            ->first();

        if (! $node instanceof KnowledgeNode) {
            throw new ApiErrorException('NODE_NOT_FOUND', 404, 'Knowledge node not found.');
        }

        return $node;
    }
}
