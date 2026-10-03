<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use App\Models\Media;
use App\Services\Media\MediaAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * دسترسی به فایل — فاز ۱۵.
 *
 *   GET /api/v1/media/{id}/access   URL استریم (خصوصی ⇒ Signed، کوتاه‌عمر)
 *   GET /api/v1/media/{id}/stream   استریم واقعی؛ خصوصی فقط با امضای معتبر
 *
 * هیچ مسیر مستقیمی بدون Policy سرو نمی‌کند (§71). Media آرشیوشده ۴۰۴ است.
 */
class MediaController extends Controller
{
    public function __construct(
        private readonly MediaAccessService $access,
    ) {}

    public function access(Request $request, string $mediaId): JsonResponse
    {
        $media = Media::query()->whereKey($mediaId)->first();

        if (! $media instanceof Media || ! $media->isActive()) {
            abort(404);
        }

        $user = $request->user();

        if (! $this->access->canUserAccess($media, $user)) {
            // ۴۰۴ نه ۴۰۳: وجودِ فایل خصوصی دیگران افشا نمی‌شود.
            abort(404);
        }

        return ApiResponse::success(['media' => $this->mediaPayload($media)]);
    }

    public function stream(Request $request, string $mediaId)
    {
        $media = Media::query()->whereKey($mediaId)->first();

        if (! $media instanceof Media || ! $media->isActive()) {
            abort(404);
        }

        if (! $media->isPublic() && ! $request->hasValidSignature()) {
            abort(403);
        }

        $disk = Storage::disk($media->disk);

        if (! $disk->exists($media->key)) {
            abort(404);
        }

        return $disk->response($media->key, $media->original_name ?? basename($media->key), [
            'Content-Type' => $media->mime,
            'Cache-Control' => $media->isPublic()
                ? 'public, max-age=31536000, immutable'
                : 'private, no-store',
        ]);
    }

    /** URL بر اساس نقش principal سشن — ادمین مثل مالک محتوا به همه دسترسی دارد. */
    private function mediaPayload(Media $media): array
    {
        $admin = request()->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);
        $user = request()->user();
        $url = null;

        if ($media->isPublic() || $user !== null || $admin instanceof Admin) {
            $url = $this->access->accessFor($media);
        }

        return [
            'id' => $media->getKey(),
            'kind' => $media->kind,
            'mime' => $media->mime,
            'sizeBytes' => $media->size_bytes,
            'visibility' => $media->visibility,
            'url' => $url['url'] ?? null,
            'expiresAt' => $url['expiresAt'] ?? null,
        ];
    }
}
