<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\References\ListReferencesRequest;
use App\Http\Resources\ReferenceResource;
use App\Models\Reference;
use App\Services\References\ReferenceQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * مراجع — عمومی، فاز ۱۵ (§14/§15).
 *
 *   GET /api/v1/references              فهرست منتشرشده (صفحه‌بندی)
 *   GET /api/v1/references/{idOrSlug}   یک مرجع + نگاشت asset برای viewer
 *
 * فقط `published`؛ draft/archived ۴۰۴ می‌دهند تا وجودشان لو نرود. Viewer از نو
 * طراحی نمی‌شود — Backend همان متادیتایی را می‌دهد که UI امروز می‌خواند.
 */
final class ReferenceController extends Controller
{
    public function __construct(
        private readonly ReferenceQueryService $query,
    ) {}

    public function index(ListReferencesRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated('perPage') ?? config('references.pagination.per_page'));

        $paginator = $this->query->publishedPaginated($perPage);

        $items = collect($paginator->items())
            ->map(fn (Reference $reference) => (new ReferenceResource($reference))
                ->additional(['assets' => $this->query->assetUrls($reference)])
                ->toArray($request));

        return ApiResponse::success(
            ['references' => $items->all()],
            Pagination::meta($paginator),
        );
    }

    public function show(string $idOrSlug): JsonResponse
    {
        $reference = $this->query->publishedByIdOrSlug($idOrSlug);

        if (! $reference instanceof Reference) {
            abort(404);
        }

        $payload = (new ReferenceResource($reference))
            ->additional(['assets' => $this->query->assetUrls($reference)])
            ->toArray(request());

        return ApiResponse::success(['reference' => $payload]);
    }
}
