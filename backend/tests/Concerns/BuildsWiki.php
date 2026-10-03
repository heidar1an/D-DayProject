<?php

namespace Tests\Concerns;

use App\Models\Admin;
use App\Models\User;
use App\Models\WikiArticle;
use App\Models\WikiCategory;
use App\Models\WikiRelation;

/**
 * ساخت دادهٔ ویکی برای تست — فاز ۱۰.
 *
 * مثل `BuildsFlashcards`: حالت‌های غیرقابل‌ساخت از API (پیش‌نویس، آرشیو،
 * نویسندهٔ ادمین) باید مستقیم روی مدل ساخته شوند تا مرزهای واقعی سنجیده شود.
 */
trait BuildsWiki
{
    /** @param array<string, mixed> $payload */
    protected function signedInStudent(array $payload = []): array
    {
        $session = $this->register($payload);
        $session->assertCreated();

        $this->withAuthCookies($session);

        $phone = $payload['phone'] ?? '09123456789';
        $user = User::query()->where('phone', $phone)->firstOrFail();

        return ['user' => $user, 'session' => $session, 'csrf' => $this->csrfHeader($session)];
    }

    /** @param array<string, mixed> $attributes */
    protected function makeCategory(array $attributes = []): WikiCategory
    {
        static $sequence = 0;

        $sequence++;

        $category = new WikiCategory;
        $category->forceFill([
            'parent_id' => $attributes['parent_id'] ?? null,
            'slug' => (string) ($attributes['slug'] ?? 'category-'.$sequence),
            'name' => (string) ($attributes['name'] ?? 'دسته '.$sequence),
            'description' => $attributes['description'] ?? null,
            'sort_order' => (int) ($attributes['sort_order'] ?? 0),
            'status' => (string) ($attributes['status'] ?? WikiCategory::STATUS_DRAFT),
        ])->save();

        return $category;
    }

    /** @param array<string, mixed> $attributes */
    protected function makeArticle(array $attributes = [], ?Admin $author = null, ?WikiCategory $category = null): WikiArticle
    {
        static $sequence = 0;

        $sequence++;

        $article = new WikiArticle;
        $article->forceFill([
            'category_id' => $attributes['category_id'] ?? $category?->getKey(),
            'slug' => (string) ($attributes['slug'] ?? 'article-'.$sequence),
            'title' => (string) ($attributes['title'] ?? 'مقالهٔ '.$sequence),
            'summary' => $attributes['summary'] ?? 'خلاصهٔ مقاله',
            'body' => (string) ($attributes['body'] ?? '<p>متن مقاله</p>'),
            'subject' => $attributes['subject'] ?? 'physiology',
            'content_type' => $attributes['content_type'] ?? 'concept',
            'difficulty' => $attributes['difficulty'] ?? 'basic',
            'key_facts' => $attributes['key_facts'] ?? null,
            'keywords' => $attributes['keywords'] ?? null,
            'read_minutes' => $attributes['read_minutes'] ?? 3,
            'popularity' => (int) ($attributes['popularity'] ?? 0),
            'view_count' => (int) ($attributes['view_count'] ?? 0),
            'status' => (string) ($attributes['status'] ?? WikiArticle::STATUS_DRAFT),
            'version' => (int) ($attributes['version'] ?? 1),
            'author_admin_id' => $attributes['author_admin_id'] ?? $author?->getKey(),
            'editor_admin_id' => null,
            'published_at' => ($attributes['status'] ?? WikiArticle::STATUS_DRAFT) === WikiArticle::STATUS_PUBLISHED
                ? ($attributes['published_at'] ?? now())
                : null,
        ])->save();

        return $article;
    }

    protected function makePublishedArticle(array $attributes = [], ?Admin $author = null, ?WikiCategory $category = null): WikiArticle
    {
        return $this->makeArticle(
            [...$attributes, 'status' => WikiArticle::STATUS_PUBLISHED],
            $author,
            $category,
        );
    }

    /** @param array<string, mixed> $attributes */
    protected function makeRelation(WikiArticle $from, WikiArticle $to, array $attributes = []): WikiRelation
    {
        $relation = new WikiRelation;
        $relation->forceFill([
            'from_article_id' => $from->getKey(),
            'to_article_id' => $to->getKey(),
            'kind' => (string) ($attributes['kind'] ?? 'related_to'),
        ])->save();

        return $relation;
    }
}
