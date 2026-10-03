<?php

namespace App\Http\Resources;

use App\Models\WikiArticle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مقالهٔ ویکی — منبع **عمومی**.
 *
 * این Resource فقط برای مقالهٔ منتشرشده ساخته می‌شود (سرویس تضمین می‌کند).
 *
 * آنچه **عمداً** نیست (§37): `author_admin_id`, `editor_admin_id`,
 * `legacy_id`, `view_count`, `status`, `version`. هیچ‌کدام برای مصرف‌کنندهٔ
 * عمومی لازم نیست و افشایشان فقط سطح حمله را بزرگ می‌کند.
 */
class WikiArticleResource extends JsonResource
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
            'body' => $article->body,
            'subject' => $article->subject,
            'content_type' => $article->content_type,
            'difficulty' => $article->difficulty,
            'key_facts' => $article->key_facts,
            'keywords' => $article->keywords,
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
