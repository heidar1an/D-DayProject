<?php

namespace App\Http\Resources;

use App\Models\KnowledgeNode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * نود از دید پنل — جدا از `KnowledgeNodeResource` عمومی.
 *
 * اینجا `status`، پیوند خام مقاله و timestampها برمی‌گردند: پنل برای مدیریت
 * (فهرست/ویرایش/انتشار/آرشیو) به آن‌ها نیاز دارد و قرارداد عمومی عوض نمی‌شود.
 *
 * @property KnowledgeNode $resource
 */
class AdminKnowledgeNodeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'label' => $this->resource->label,
            'kind' => $this->resource->kind,
            'status' => $this->resource->status,
            'wiki_article_id' => $this->resource->wiki_article_id,
            'article_slug' => $this->resource->wikiArticle?->slug,
            'edges_count' => (int) ($this->resource->edges_count ?? 0),
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'updated_at' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
