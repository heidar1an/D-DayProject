<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * نشان مقاله — فاز ۱۶. آینهٔ WikiBookmarkResource.
 *
 * @property \App\Models\ArticleBookmark $resource
 */
final class ArticleBookmarkResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $article = $this->resource->article;

        return [
            'id' => $this->resource->getKey(),
            'article_id' => $this->resource->article_id,
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'article' => $article === null ? null : ArticleSummaryResource::make($article)->toArray($request),
        ];
    }
}
