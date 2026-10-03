<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\Media\Admin\StoreMediaRequest;
use App\Models\Admin;
use App\Models\Media;
use App\Services\Media\MediaAccessService;
use App\Services\Media\MediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * پنل Media — فاز ۱۵.
 *
 *   POST   /api/v1/admin/media/uploads   آپلود (api.can:media.upload)
 *   GET    /api/v1/admin/media           فهرست (api.can:media.read)
 *   POST   /api/v1/admin/media/{id}/archive   آرشیو (api.can:media.delete)
 *   DELETE /api/v1/admin/media/{id}      حذف فیزیکیِ رکورد آرشیوشده
 *
 * Media Center/پلیتفرم انتشار عمداً اینجا نیست (§22) — این فقط Media Core است.
 */
final class AdminMediaController extends Controller
{
    public function __construct(
        private readonly MediaService $media,
        private readonly MediaAccessService $access,
    ) {}

    public function upload(StoreMediaRequest $request): JsonResponse
    {
        $uploader = $this->admin($request);

        $record = $this->media->store($uploader, $request->fileUpload(), [
            'visibility' => $request->validated('visibility') ?? Media::VISIBILITY_PRIVATE,
        ]);

        return ApiResponse::success(['media' => $this->mediaPayload($record)], null, 201);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('perPage', (string) config('media.pagination.per_page'));
        $perPage = min(max($perPage, 1), (int) config('media.pagination.max_per_page'));

        $paginator = Media::query()
            ->where('status', Media::STATUS_ACTIVE)
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return ApiResponse::success(
            ['media' => $paginator->getCollection()->map(fn (Media $m) => $this->mediaPayload($m))->all()],
            [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        );
    }

    public function archive(string $id): JsonResponse
    {
        $record = $this->mediaOrFail($id);
        $this->media->archive($record);

        return ApiResponse::success(['media' => ['id' => $record->getKey(), 'status' => $record->status]]);
    }

    public function destroy(string $id): JsonResponse
    {
        $this->media->deleteArchived($this->mediaOrFail($id));

        return ApiResponse::success(null, null, 204);
    }

    private function mediaOrFail(string $id): Media
    {
        $record = Media::query()->whereKey($id)->first();

        if (! $record instanceof Media) {
            abort(404);
        }

        return $record;
    }

    /** @return array<string, mixed> */
    private function mediaPayload(Media $record): array
    {
        $url = $this->access->accessFor($record);

        return [
            'id' => $record->getKey(),
            'kind' => $record->kind,
            'mime' => $record->mime,
            'sizeBytes' => $record->size_bytes,
            'sha256' => $record->sha256,
            'visibility' => $record->visibility,
            'status' => $record->status,
            'originalName' => $record->original_name,
            'metadata' => $record->metadata,
            'url' => $url['url'],
            'expiresAt' => $url['expiresAt'],
            'createdAt' => $record->created_at?->toIso8601String(),
        ];
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
