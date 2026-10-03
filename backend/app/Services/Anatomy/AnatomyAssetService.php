<?php

namespace App\Services\Anatomy;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\AnatomyAsset;
use App\Models\Media;

/**
 * چرخهٔ حیات Anatomy Asset — فاز ۱۵ (§16-§18).
 *
 * فقط نگاشت part_key → Media. `category` از allowlist واقعی viewer می‌آید و
 * `part_key` یکتاست (UNIQUE در دیتابیس). هیچ باینری‌ای اینجا ذخیره نمی‌شود.
 */
final class AnatomyAssetService
{
    /** @param array<string, mixed> $data */
    public function create(Admin $author, array $data): AnatomyAsset
    {
        $asset = new AnatomyAsset;
        $asset->forceFill([
            'media_id' => (string) $data['mediaId'],
            'subject_id' => $data['subjectId'] ?? null,
            'part_key' => (string) $data['partKey'],
            'label' => $data['label'] ?? null,
            'category' => $data['category'] ?? null,
            'status' => AnatomyAsset::STATUS_DRAFT,
            'version' => 1,
            'author_admin_id' => $author->getKey(),
        ]);
        $asset->save();

        return $asset;
    }

    /** @param array<string, mixed> $data */
    public function update(Admin $editor, AnatomyAsset $asset, array $data): AnatomyAsset
    {
        if (array_key_exists('expectedVersion', $data) && (int) $data['expectedVersion'] !== (int) $asset->version) {
            throw new ApiErrorException('VERSION_CONFLICT', 409, 'The asset was modified by someone else.');
        }

        foreach (['mediaId' => 'media_id', 'subjectId' => 'subject_id', 'label' => 'label', 'category' => 'category'] as $input => $column) {
            if (array_key_exists($input, $data)) {
                $asset->{$column} = $data[$input];
            }
        }

        if (array_key_exists('partKey', $data) && $data['partKey'] !== $asset->part_key) {
            // part_key هویت asset است؛ تغییرش = ساخت asset تازه، نه ویرایش.
            throw new ApiErrorException('PART_KEY_IMMUTABLE', 422, 'part_key is immutable; create a new asset instead.');
        }

        $asset->editor_admin_id = $editor->getKey();
        $asset->version = (int) $asset->version + 1;
        $asset->save();

        return $asset;
    }

    public function publish(AnatomyAsset $asset): AnatomyAsset
    {
        $asset->forceFill([
            'status' => AnatomyAsset::STATUS_PUBLISHED,
            'published_at' => $asset->published_at ?? now(),
        ])->save();

        return $asset;
    }

    public function archive(AnatomyAsset $asset): AnatomyAsset
    {
        $asset->forceFill(['status' => AnatomyAsset::STATUS_ARCHIVED])->save();

        return $asset;
    }

    /** Media باید فعال باشد؛ asset به فایل مرده وصل نمی‌شود. */
    public function activeMediaOrFail(string $mediaId): Media
    {
        /** @var Media|null */
        $media = Media::query()->whereKey($mediaId)->first();

        if (! $media instanceof Media || ! $media->isActive()) {
            throw new ApiErrorException('VALIDATION_FAILED', 422, 'mediaId does not refer to an active media.', ['mediaId' => ['The selected media id is invalid.']]);
        }

        return $media;
    }
}
