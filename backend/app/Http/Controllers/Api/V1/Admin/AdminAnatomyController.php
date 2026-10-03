<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\Anatomy\Admin\StoreAnatomyAssetRequest;
use App\Http\Requests\Anatomy\Admin\UpdateAnatomyAssetRequest;
use App\Http\Resources\AdminAnatomyAssetResource;
use App\Models\Admin;
use App\Models\AnatomyAsset;
use App\Services\Anatomy\AnatomyAssetService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * پنل آناتومی — فاز ۱۵ (§70).
 *
 * کلید مجوز: `references.*` — آناتومی (اطلس سه‌بعدی) در RBAC واقعی پنل کلید
 * مستقل ندارد و کلید اختراعی یعنی شکستن deny-by-default. انتخاب مستندشده در
 * گزارش فاز ۱۵.
 */
final class AdminAnatomyController extends Controller
{
    public function __construct(
        private readonly AnatomyAssetService $assets,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('perPage', (string) config('anatomy.pagination.per_page'));
        $perPage = min(max($perPage, 1), (int) config('anatomy.pagination.max_per_page'));

        $query = AnatomyAsset::query()->with('media')->orderBy('part_key');

        $status = (string) $request->query('status', '');

        if (in_array($status, (array) config('anatomy.statuses'), true)) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate($perPage);

        return ApiResponse::success(
            ['assets' => AdminAnatomyAssetResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function store(StoreAnatomyAssetRequest $request): JsonResponse
    {
        $media = $this->assets->activeMediaOrFail((string) $request->validated('mediaId'));
        $asset = $this->assets->create($this->admin($request), $request->validated());

        return ApiResponse::success(['asset' => new AdminAnatomyAssetResource($asset->setRelation('media', $media))], null, 201);
    }

    public function update(UpdateAnatomyAssetRequest $request, string $id): JsonResponse
    {
        $asset = $this->assetOrFail($id);

        if ($request->validated('mediaId') !== null) {
            $this->assets->activeMediaOrFail((string) $request->validated('mediaId'));
        }

        $asset = $this->assets->update($this->admin($request), $asset, $request->validated());

        return ApiResponse::success(['asset' => new AdminAnatomyAssetResource($asset)]);
    }

    public function publish(string $id): JsonResponse
    {
        return ApiResponse::success(['asset' => new AdminAnatomyAssetResource($this->assets->publish($this->assetOrFail($id)))]);
    }

    public function archive(string $id): JsonResponse
    {
        return ApiResponse::success(['asset' => new AdminAnatomyAssetResource($this->assets->archive($this->assetOrFail($id)))]);
    }

    private function assetOrFail(string $id): AnatomyAsset
    {
        /** @var AnatomyAsset|null */
        $asset = AnatomyAsset::query()->with('media')->whereKey($id)->first();

        if (! $asset instanceof AnatomyAsset) {
            abort(404);
        }

        return $asset;
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
