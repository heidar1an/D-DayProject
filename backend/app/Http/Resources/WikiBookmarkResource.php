<?php

namespace App\Http\Resources;

use App\Models\WikiBookmark;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * نشان‌گذاری کاربر.
 *
 * `user_id` **serialize نمی‌شود** — کلاینت لازم ندارد و افشای آن هیچ سودی
 * ندارد. مقالهٔ مربوطه با خلاصهٔ عمومی نمایش داده می‌شود.
 */
class WikiBookmarkResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var WikiBookmark $bookmark */
        $bookmark = $this->resource;

        return [
            'id' => $bookmark->getKey(),
            'article_id' => $bookmark->article_id,
            'created_at' => $bookmark->created_at?->toIso8601String(),
            'article' => $bookmark->relationLoaded('article') && $bookmark->article !== null
                ? (new WikiArticleSummaryResource($bookmark->article))->resolve($request)
                : null,
        ];
    }
}
