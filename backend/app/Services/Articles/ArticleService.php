<?php

namespace App\Services\Articles;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\Article;
use App\Support\Content\RichTextSanitizer;

/**
 * چرخهٔ حیات Article — فاز ۱۶ (§24/§26/§29/§30).
 *
 * `body` فقط از پاک‌ساز whitelist عبور می‌کند (Stored XSS §29) و `status`/
 * `published_at`/`author_admin_id` هرگز از بدنهٔ درخواست نمی‌آیند. هر آپدیت
 * `version` را بالا می‌برد و `expectedVersion` ناهم‌خوان ۴۰۹ می‌گیرد (§30).
 */
final class ArticleService
{
    public function __construct(
        private readonly RichTextSanitizer $sanitizer,
    ) {}

    /** @param array<string, mixed> $data */
    public function create(Admin $author, array $data): Article
    {
        $article = new Article;
        $article->forceFill([
            'category_id' => $data['categoryId'] ?? null,
            'slug' => (string) $data['slug'],
            'title' => (string) $data['title'],
            'summary' => $data['summary'] ?? null,
            'status' => Article::STATUS_DRAFT,
            'version' => 1,
            'author_admin_id' => $author->getKey(),
        ]);
        $article->body = (string) $this->sanitizer->sanitize((string) ($data['body'] ?? ''), 'rich');
        $article->save();

        return $article;
    }

    /** @param array<string, mixed> $data */
    public function update(Admin $editor, Article $article, array $data): Article
    {
        if (array_key_exists('expectedVersion', $data) && (int) $data['expectedVersion'] !== (int) $article->version) {
            throw new ApiErrorException('VERSION_CONFLICT', 409, 'The article was modified by someone else.');
        }

        foreach (['categoryId' => 'category_id', 'slug' => 'slug', 'title' => 'title', 'summary' => 'summary'] as $input => $column) {
            if (array_key_exists($input, $data)) {
                $article->{$column} = $data[$input];
            }
        }

        if (array_key_exists('body', $data)) {
            $article->body = (string) $this->sanitizer->sanitize((string) $data['body'], 'rich');
        }

        $article->editor_admin_id = $editor->getKey();
        $article->version = (int) $article->version + 1;
        $article->save();

        return $article;
    }

    public function publish(Article $article): Article
    {
        $article->forceFill([
            'status' => Article::STATUS_PUBLISHED,
            'published_at' => $article->published_at ?? now(),
        ])->save();

        return $article;
    }

    public function archive(Article $article): Article
    {
        $article->forceFill(['status' => Article::STATUS_ARCHIVED])->save();

        return $article;
    }
}
