<?php

namespace App\Http\Resources;

use App\Models\WikiArticle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مقالهٔ ویکی — منبع **پنل**.
 *
 * تفاوت با منبع عمومی عمدی و صریح است (§42):
 *   • `status` و `version` برای ویرایش/optimistic lock لازم‌اند.
 *   • `author_admin_id`/`editor_admin_id` برای پاسخ به «چه کسی نوشت/آخرین بار
 *     ویرایش کرد» لازم‌اند.
 *   • `legacy_id` برای crosswalk مهاجرت.
 *
 * حتی همین‌ها هم حداقلی‌اند: هیچ دادهٔ کاربر، هیچ بازدید و هیچ محتوای حساس
 * دیگری اینجا نیست.
 */
class AdminWikiArticleResource extends JsonResource
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
            'status' => $article->status,
            'version' => (int) $article->version,
            'category_id' => $article->category_id,
            'subject' => $article->subject,
            'content_type' => $article->content_type,
            'difficulty' => $article->difficulty,
            'key_facts' => $article->key_facts,
            'keywords' => $article->keywords,
            'read_minutes' => $article->read_minutes === null ? null : (int) $article->read_minutes,
            'popularity' => (int) $article->popularity,
            'view_count' => (int) $article->view_count,
            'author_admin_id' => $article->author_admin_id,
            'editor_admin_id' => $article->editor_admin_id,
            'published_at' => $article->published_at?->toIso8601String(),
            'created_at' => $article->created_at?->toIso8601String(),
            'updated_at' => $article->updated_at?->toIso8601String(),
        ];
    }
}
