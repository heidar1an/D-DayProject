<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مقالهٔ کامل عمومی — فاز ۱۶. body متن پاک‌سازی‌شده است (whitelist سمت سرور).
 *
 * @property \App\Models\Article $resource
 */
final class ArticleResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            ...ArticleSummaryResource::make($this->resource)->toArray($request),
            'body' => $this->resource->body,
        ];
    }
}
