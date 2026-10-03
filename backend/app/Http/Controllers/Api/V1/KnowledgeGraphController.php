<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Knowledge\KnowledgeGraphRequest;
use App\Http\Resources\KnowledgeEdgeResource;
use App\Http\Resources\KnowledgeNodeResource;
use App\Models\KnowledgeNode;
use App\Services\Knowledge\KnowledgeGraphService;
use Illuminate\Http\JsonResponse;

/**
 * گراف دانش (عمومی) — فاز ۱۲.
 *
 *   GET /api/v1/knowledge/graph              ?node=&depth=&kind=&relation=
 *   GET /api/v1/knowledge/nodes/{id}         جزئیات نود + همسایه‌های برچسب‌دار
 *   GET /api/v1/knowledge/nodes/{id}/neighbors
 *
 * همهٔ مسیرها فقط `published` را می‌بینند؛ نود خصوصی و یال به آن ۴۰۴ است نه
 * ۴۰۳ — وجود منبع خصوصی افشا نمی‌شود.
 */
class KnowledgeGraphController extends Controller
{
    public function __construct(private readonly KnowledgeGraphService $graph) {}

    public function index(KnowledgeGraphRequest $request): JsonResponse
    {
        $filters = $request->validated();

        $result = $this->graph->graph(
            isset($filters['node']) && $filters['node'] !== '' ? (string) $filters['node'] : null,
            isset($filters['depth']) ? (int) $filters['depth'] : null,
            $filters['kind'] ?? null,
            $filters['relation'] ?? null,
        );

        return ApiResponse::success(
            [
                'nodes' => KnowledgeNodeResource::collection($result['nodes']),
                'edges' => KnowledgeEdgeResource::collection($result['edges']),
            ],
            $result['meta'],
        );
    }

    public function show(string $nodeId): JsonResponse
    {
        $result = $this->graph->nodeDetail($nodeId);

        return ApiResponse::success([
            'node' => new KnowledgeNodeResource($result['nodes'][0]),
            'neighbors' => $this->renderNeighbors($result['neighbors']),
        ]);
    }

    public function neighbors(string $nodeId): JsonResponse
    {
        $node = $this->graph->publishedNode($nodeId);

        return ApiResponse::success([
            'node' => new KnowledgeNodeResource($node),
            'neighbors' => $this->renderNeighbors($this->graph->neighbors($node)),
        ]);
    }

    /**
     * همسایه با نوع و جهت رابطه — برچسب فارسی در فرانت از `RELATION_TYPES`
     * ساخته می‌شود؛ سمت سرور فقط دادهٔ قطعی می‌دهد.
     *
     * @param  list<array{node: KnowledgeNode, relation: array{type: string, direction: string, weight: float|null}}>  $neighbors
     * @return list<array<string, mixed>>
     */
    private function renderNeighbors(array $neighbors): array
    {
        return array_map(
            fn (array $neighbor): array => [
                'node' => new KnowledgeNodeResource($neighbor['node']),
                'relation' => [
                    'type' => $neighbor['relation']['type'],
                    'direction' => $neighbor['relation']['direction'],
                    'weight' => $neighbor['relation']['weight'],
                ],
            ],
            $neighbors,
        );
    }
}
