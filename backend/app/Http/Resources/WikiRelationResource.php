<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * یک لبهٔ گراف ویکی — از دید یک مقاله.
 *
 * `direction` = `outgoing` (این مقاله به آن اشاره دارد) یا `incoming`
 * (آن مقاله به این یکی اشاره دارد). این تفکیک برای UI لازم است ولی **گراف
 * واقعی نیست**: فاز ۱۱ مالک `knowledge_nodes`/`knowledge_edges` است.
 */
class WikiRelationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed> $row */
        $row = $this->resource;

        return [
            'article_id' => $row['article_id'],
            'slug' => $row['slug'],
            'title' => $row['title'],
            'summary' => $row['summary'],
            'subject' => $row['subject'],
            'content_type' => $row['content_type'],
            'difficulty' => $row['difficulty'],
            'kind' => $row['kind'],
            'kind_label' => $row['kind_label'],
            'direction' => $row['direction'],
        ];
    }
}
