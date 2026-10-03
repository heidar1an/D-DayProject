<?php

namespace App\Services\Anatomy;

use App\Models\AnatomyAsset;
use Illuminate\Support\Facades\URL;

/**
 * کوئری عمومی Anatomy — فاز ۱۵ (§18).
 *
 * فقط `published`. طبق §18 Detail endpoint ساخته نمی‌شود چون viewer واقعی
 * امروز هیچ فراخوانی API ندارد؛ این کاتالوگ، قرارداد سمت سرور برای اتصال آینده
 * و منبع نگاشت part_key → Media است.
 */
final class AnatomyQueryService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function publishedCatalog(): array
    {
        return AnatomyAsset::query()
            ->where('status', AnatomyAsset::STATUS_PUBLISHED)
            ->with('media')
            ->orderBy('part_key')
            ->get()
            ->map(fn (AnatomyAsset $asset) => $this->publicRow($asset))
            ->all();
    }

    /** @return array<string, mixed> */
    public function publicRow(AnatomyAsset $asset): array
    {
        $media = $asset->media;

        $url = null;
        $expiresAt = null;

        if ($media !== null && $media->isActive()) {
            if ($media->isPublic()) {
                $url = URL::route('api.v1.media.stream', ['id' => $media->getKey()]);
            } else {
                $expiresAt = now()->addMinutes((int) config('media.signed_ttl_minutes'));
                $url = URL::temporarySignedRoute('api.v1.media.stream', $expiresAt, ['id' => $media->getKey()]);
            }
        }

        return [
            'id' => $asset->getKey(),
            'part_key' => $asset->part_key,
            'label' => $asset->label,
            'category' => $asset->category,
            'subject_id' => $asset->subject_id,
            'media' => $media === null ? null : [
                'id' => $media->getKey(),
                'mime' => $media->mime,
                'size_bytes' => (int) $media->size_bytes,
            ],
            'url' => $url,
            'url_expires_at' => $expiresAt?->toIso8601String(),
            'updated_at' => $asset->updated_at?->toIso8601String(),
        ];
    }
}
