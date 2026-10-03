<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\References\Admin\AttachReferenceAssetRequest;
use App\Http\Requests\References\Admin\StoreReferenceRequest;
use App\Http\Requests\References\Admin\UpdateReferenceRequest;
use App\Http\Resources\AdminReferenceResource;
use App\Models\Admin;
use App\Models\Media;
use App\Models\Reference;
use App\Services\References\ReferenceService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * پنل مراجع — فاز ۱۵ (§70).
 *
 * مجوزهای واقعی پنل: `references.*` از AdminRbacSeeder — کلید اختراعی ساخته
 * نشد (deny-by-default شکسته نمی‌شود). مسیر assetها: POST/DELETE روی
 * /admin/references/{id}/assets.
 */
final class AdminReferenceController extends Controller
{
    public function __construct(
        private readonly ReferenceService $references,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('perPage', (string) config('references.pagination.per_page'));
        $perPage = min(max($perPage, 1), (int) config('references.pagination.max_per_page'));

        $query = Reference::query()->orderByDesc('updated_at');

        $status = (string) $request->query('status', '');

        if (in_array($status, (array) config('references.statuses'), true)) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate($perPage);

        return ApiResponse::success(
            ['references' => AdminReferenceResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function show(string $id): JsonResponse
    {
        return ApiResponse::success(['reference' => new AdminReferenceResource($this->referenceOrFail($id))]);
    }

    public function store(StoreReferenceRequest $request): JsonResponse
    {
        $reference = $this->references->create($this->admin($request), $request->validated());

        return ApiResponse::success(['reference' => new AdminReferenceResource($reference)], null, 201);
    }

    public function update(UpdateReferenceRequest $request, string $id): JsonResponse
    {
        $reference = $this->references->update(
            $this->admin($request),
            $this->referenceOrFail($id),
            $request->validated(),
        );

        return ApiResponse::success(['reference' => new AdminReferenceResource($reference)]);
    }

    public function publish(string $id): JsonResponse
    {
        $reference = $this->references->publish($this->referenceOrFail($id));

        return ApiResponse::success(['reference' => new AdminReferenceResource($reference)]);
    }

    public function archive(string $id): JsonResponse
    {
        $reference = $this->references->archive($this->referenceOrFail($id));

        return ApiResponse::success(['reference' => new AdminReferenceResource($reference)]);
    }

    public function attachAsset(AttachReferenceAssetRequest $request, string $id): JsonResponse
    {
        $reference = $this->referenceOrFail($id);

        /** @var Media|null */
        $media = Media::query()->whereKey((string) $request->validated('mediaId'))->first();
        $asset = $this->references->attachAsset($reference, $media, $request->validated('key'));

        return ApiResponse::success([
            'asset' => [
                'id' => $asset->getKey(),
                'reference_id' => $reference->getKey(),
                'media_id' => $media->getKey(),
                'key' => $asset->key,
            ],
        ], null, 201);
    }

    public function detachAsset(string $id, string $assetId): JsonResponse
    {
        $this->references->detachAsset($this->referenceOrFail($id), $assetId);

        return ApiResponse::success(null, null, 204);
    }

    private function referenceOrFail(string $id): Reference
    {
        $reference = Reference::query()->whereKey($id)->first();

        if (! $reference instanceof Reference) {
            abort(404);
        }

        return $reference;
    }

    private function admin(Request $request): Admin
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            abort(401);
        }

        return $admin;
    }
}
