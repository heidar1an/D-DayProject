<?php

namespace App\Http\Resources;

use App\Models\WikiArticle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * خلاصهٔ مقاله — برای فهرست/جست‌وجو/پیشنهاد.
 *
 * **هیچ متادیتای نویسنده‌ای اینجا نیست** (§37): نه `author_admin_id`، نه
 * `editor_admin_id`، نه `legacy_id`. فقط چیزی که UI عمومی مصرف می‌کند.
 */
class WikiArticleSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var WikiArticle $article */
        $article = $this->resource;

        return [
            'id' => $article->getKey(),
            'slug' => $article->slug,
            'title' => $article->title,
            'summary' => $article->summary,
            'subject' => $article->subject,
            'content_type' => $article->content_type,
            'difficulty' => $article->difficulty,
            'read_minutes' => $article->read_minutes === null ? null : (int) $article->read_minutes,
            'popularity' => (int) $article->popularity,
            'category' => $article->relationLoaded('category') && $article->category !== null
                ? ['id' => $article->category->getKey(), 'slug' => $article->category->slug, 'name' => $article->category->name]
                : null,
            'published_at' => $article->published_at?->toIso8601String(),
            'updated_at' => $article->updated_at?->toIso8601String(),
        ];
    }
}
