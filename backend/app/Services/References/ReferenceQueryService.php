<?php

namespace App\Services\References;

use App\Models\Media;
use App\Models\Reference;
use App\Models\ReferenceAsset;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\URL;

/**
 * کوئری عمومی Reference — فاز ۱۵ (§14).
 *
 * فقط `published` در مسیر عمومی دیده می‌شود؛ draft/archived در همان ۴۰۴ گم
 * می‌شوند تا وجودشان افشا نشود. Asset URL در زمان خواندن ساخته می‌شود — فایل
 * خصوصی URL امضاشدهٔ کوتاه‌عمر می‌گیرد، نه لینک دائمی (§6).
 */
final class ReferenceQueryService
{
    public const FILTERS = ['page', 'perPage'];

    /** @return LengthAwarePaginator<int, Reference> */
    public function publishedPaginated(int $perPage): LengthAwarePaginator
    {
        return Reference::query()
            ->where('status', Reference::STATUS_PUBLISHED)
            ->orderByDesc('published_at')
            ->paginate($perPage);
    }

    public function publishedByIdOrSlug(string $idOrSlug): ?Reference
    {
        $query = Reference::query()->where('status', Reference::STATUS_PUBLISHED);

        return \Illuminate\Support\Str::isUuid($idOrSlug)
            ? $query->whereKey($idOrSlug)->first()
            : $query->where('slug', $idOrSlug)->first();
    }

    /**
     * نگاشت asset کلید → URL استریم برای viewer.
     *
     * @return array<string, string>
     */
    public function assetUrls(Reference $reference): array
    {
        $urls = [];

        ReferenceAsset::query()
            ->where('reference_id', $reference->getKey())
            ->with('media')
            ->get()
            ->each(function (ReferenceAsset $asset) use (&$urls): void {
                /** @var Media|null $media */
                $media = $asset->media;

                if (! $media instanceof Media || ! $media->isActive()) {
                    return;
                }

                if ($media->isPublic()) {
                    $urls[(string) $asset->key] = URL::route('api.v1.media.stream', ['id' => $media->getKey()]);

                    return;
                }

                $urls[(string) $asset->key] = URL::temporarySignedRoute(
                    'api.v1.media.stream',
                    now()->addMinutes((int) config('media.signed_ttl_minutes')),
                    ['id' => $media->getKey()],
                );
            });

        return $urls;
    }
}
