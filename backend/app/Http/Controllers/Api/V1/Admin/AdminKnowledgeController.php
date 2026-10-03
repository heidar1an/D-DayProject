<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Knowledge\Admin\AdminListKnowledgeNodesRequest;
use App\Http\Requests\Knowledge\Admin\StoreKnowledgeEdgeRequest;
use App\Http\Requests\Knowledge\Admin\StoreKnowledgeNodeRequest;
use App\Http\Requests\Knowledge\Admin\UpdateKnowledgeNodeRequest;
use App\Http\Resources\AdminKnowledgeNodeResource;
use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use App\Services\Knowledge\KnowledgeEdgeService;
use App\Services\Knowledge\KnowledgeNodeService;
use App\Services\Knowledge\KnowledgeQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * پنل گراف دانش — فاز ۱۲.
 *
 *   نود: GET/POST /api/v1/admin/knowledge/nodes
 *        GET/PATCH/DELETE /api/v1/admin/knowledge/nodes/{id}
 *        POST /api/v1/admin/knowledge/nodes/{id}/publish|archive
 *   یال: POST /api/v1/admin/knowledge/edges
 *        DELETE /api/v1/admin/knowledge/edges/{id}
 *
 * **کلیدهای مجوز واقعی پنل**: `articles.*` — همان نقشه‌ای که ویکی فاز ۱۰
 * گرفت. گراف دانش محتوای دانشی است و RBAC واقعی کلید `knowledge.*` ندارد؛
 * کلید اختراعی یعنی شکستن deny-by-default. Role جدید هم ساخته نشد.
 *
 * ⚠️ صادقانه: پنل فعلی UI اختصاصی گراف ندارد؛ این مسیرها قرارداد سمت سرور
 * برای مدیریت محتوای گراف‌اند (نیاز واقعی: پر کردن گراف). UI جدید در این فاز
 * ساخته نشد (§24).
 */
class AdminKnowledgeController extends Controller
{
    public function __construct(
        private readonly KnowledgeNodeService $nodes,
        private readonly KnowledgeEdgeService $edges,
        private readonly KnowledgeQueryService $query,
    ) {}

    // ── نود ─────────────────────────────────────────────────────────────

    public function nodes(AdminListKnowledgeNodesRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('wiki.pagination.per_page'));

        $paginator = $this->query->adminList($data, $perPage);

        return ApiResponse::success(
            ['nodes' => AdminKnowledgeNodeResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function showNode(string $id): JsonResponse
    {
        return ApiResponse::success(['node' => new AdminKnowledgeNodeResource($this->nodeOrFail($id))]);
    }

    public function storeNode(StoreKnowledgeNodeRequest $request): JsonResponse
    {
        $node = $this->nodes->create($request->validated());

        return ApiResponse::success(['node' => new AdminKnowledgeNodeResource($node)], null, 201);
    }

    public function updateNode(UpdateKnowledgeNodeRequest $request, string $id): JsonResponse
    {
        $node = $this->nodes->update($this->nodeOrFail($id), $request->validated());

        return ApiResponse::success(['node' => new AdminKnowledgeNodeResource($node)]);
    }

    public function publishNode(string $id): JsonResponse
    {
        $node = $this->nodes->publish($this->nodeOrFail($id));

        return ApiResponse::success(['node' => new AdminKnowledgeNodeResource($node)]);
    }

    public function archiveNode(string $id): JsonResponse
    {
        $node = $this->nodes->archive($this->nodeOrFail($id));

        return ApiResponse::success(['node' => new AdminKnowledgeNodeResource($node)]);
    }

    public function destroyNode(string $id): JsonResponse
    {
        $this->nodes->delete($this->nodeOrFail($id));

        return ApiResponse::success(null, null, 204);
    }

    // ── یال ─────────────────────────────────────────────────────────────

    public function storeEdge(StoreKnowledgeEdgeRequest $request): JsonResponse
    {
        $edge = $this->edges->create($request->validated());

        return ApiResponse::success(['edge' => $this->edgeRow($edge)], null, 201);
    }

    public function destroyEdge(string $id): JsonResponse
    {
        $edge = KnowledgeEdge::query()->whereKey($id)->first();

        if (! $edge instanceof KnowledgeEdge) {
            abort(404);
        }

        $this->edges->delete($edge);

        return ApiResponse::success(null, null, 204);
    }

    /**
     * قرارداد **پنل** برای یک یال — شامل `id` خودِ یال؛ پنل برای حذف به
     * `DELETE /api/v1/admin/knowledge/edges/{id}` نیاز دارد. قرارداد عمومی
     * (`KnowledgeEdgeResource`) عمداً بدون id ماند.
     *
     * @return array<string, mixed>
     */
    private function edgeRow(KnowledgeEdge $edge): array
    {
        return [
            'id' => $edge->getKey(),
            'from' => $edge->from_node_id,
            'to' => $edge->to_node_id,
            'relation' => $edge->relation_type,
            'weight' => $edge->weight,
        ];
    }

    private function nodeOrFail(string $id): KnowledgeNode
    {
        $node = $this->query->adminFind($id);

        if (! $node instanceof KnowledgeNode) {
            abort(404);
        }

        return $node;
    }
}
