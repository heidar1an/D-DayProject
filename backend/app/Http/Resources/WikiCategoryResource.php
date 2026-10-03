<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * دستهٔ ویکی — گره درخت (با فرزندان).
 *
 * payload یک آرایهٔ از پیش ساخته‌شده از `WikiCategoryService` است، نه مدل؛ چون
 * درخت با یک پاس ساخته می‌شود و تبدیل مدل→درخت نباید در Resource تکرار شود.
 */
class WikiCategoryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed> $node */
        $node = $this->resource;

        return [
            'id' => $node['id'],
            'slug' => $node['slug'],
            'name' => $node['name'],
            'description' => $node['description'],
            'parent_id' => $node['parent_id'],
            'sort_order' => (int) $node['sort_order'],
            'status' => $node['status'],
            'articles_count' => (int) $node['articles_count'],
            'children' => array_map(
                fn (array $child): array => (new self($child))->resolve($request),
                $node['children'] ?? [],
            ),
        ];
    }
}
