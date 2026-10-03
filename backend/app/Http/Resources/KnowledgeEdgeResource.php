<?php

namespace App\Http\Resources;

use App\Models\KnowledgeEdge;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * یال عمومی گراف — قرارداد §15 پرامپت: `{from, to, relation}`.
 *
 * از شناسهٔ داخلی یال، timestamp و weight داخلی جز وقتی معنادار است خبری نیست؛
 * `weight` فقط وقتی می‌آید که روی یال ثبت شده باشد.
 *
 * @property KnowledgeEdge $resource
 */
class KnowledgeEdgeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'from' => $this->resource->from_node_id,
            'to' => $this->resource->to_node_id,
            'relation' => $this->resource->relation_type,
            'weight' => $this->resource->weight,
        ];
    }
}
