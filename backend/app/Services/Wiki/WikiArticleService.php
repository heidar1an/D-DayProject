<?php

namespace App\Services\Wiki;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\WikiArticle;
use App\Models\WikiCategory;
use App\Support\Content\PersianText;
use App\Support\Content\RichTextSanitizer;
use Illuminate\Database\Eloquent\Builder;

/**
 * چرخهٔ عمر مقالهٔ ویکی — تنها نویسندهٔ `wiki_articles`.
 *
 * مرز اعتماد (§46): `author_admin_id`، `version`، `published_at`، `view_count`
 * و `popularity` هرگز از بدنه خوانده نمی‌شوند. `status` فقط از مسیرهای
 * publish/archive عوض می‌شود، نه از PATCH.
 *
 * پاک‌سازی (§36): `body` با پروفایل `rich` از فیلتر whitelist عبور می‌کند و
 * **پیش از ذخیره**؛ پس payload خطرناک هرگز در دیتابیس نمی‌نشیند.
 */
class WikiArticleService
{
    public function __construct(private readonly RichTextSanitizer $sanitizer) {}

    /** @param array<string, mixed> $data */
    public function create(Admin $admin, array $data): WikiArticle
    {
        $article = new WikiArticle;
        $article->forceFill([
            'category_id' => $this->categoryId($data['categoryId'] ?? null),
            'slug' => $this->slug((string) $data['slug'], null),
            'title' => $this->title((string) $data['title']),
            'summary' => $this->plain($data['summary'] ?? null),
            'body' => $this->body((string) $data['body']),
            'subject' => $data['subject'] ?? null,
            'content_type' => $data['contentType'] ?? null,
            'difficulty' => $data['difficulty'] ?? null,
            'key_facts' => $this->facts($data['keyFacts'] ?? null),
            'keywords' => $this->keywords($data['keywords'] ?? null),
            'read_minutes' => $data['readMinutes'] ?? null,
            'popularity' => 0,
            'view_count' => 0,
            'status' => WikiArticle::STATUS_DRAFT,
            'version' => 1,
            'author_admin_id' => $admin->getKey(),
            'editor_admin_id' => null,
            'published_at' => null,
        ])->save();

        return $article;
    }

    /**
     * ویرایش مقاله با optimistic lock.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Admin $admin, WikiArticle $article, array $data): WikiArticle
    {
        $expected = $data['version'] ?? null;

        if ($expected !== null && (int) $expected !== (int) $article->version) {
            throw new ApiErrorException(
                'VERSION_CONFLICT',
                409,
                'The article was modified by another request.',
                ['version' => ['VERSION_CONFLICT']],
            );
        }

        $attributes = ['editor_admin_id' => $admin->getKey()];

        if (array_key_exists('slug', $data)) {
            $attributes['slug'] = $this->slug((string) $data['slug'], $article);
        }

        if (array_key_exists('title', $data)) {
            $attributes['title'] = $this->title((string) $data['title']);
        }

        if (array_key_exists('summary', $data)) {
            $attributes['summary'] = $this->plain($data['summary']);
        }

        if (array_key_exists('body', $data)) {
            $attributes['body'] = $this->body((string) $data['body']);
        }

        if (array_key_exists('categoryId', $data)) {
            $attributes['category_id'] = $this->categoryId($data['categoryId']);
        }

        foreach (['subject' => 'subject', 'contentType' => 'content_type', 'difficulty' => 'difficulty'] as $input => $column) {
            if (array_key_exists($input, $data)) {
                $attributes[$column] = $data[$input];
            }
        }

        if (array_key_exists('keyFacts', $data)) {
            $attributes['key_facts'] = $this->facts($data['keyFacts']);
        }

        if (array_key_exists('keywords', $data)) {
            $attributes['keywords'] = $this->keywords($data['keywords']);
        }

        if (array_key_exists('readMinutes', $data)) {
            $attributes['read_minutes'] = $data['readMinutes'];
        }

        $attributes['version'] = (int) $article->version + 1;

        $article->forceFill($attributes)->save();

        return $article;
    }

    public function publish(WikiArticle $article): WikiArticle
    {
        $article->forceFill([
            'status' => WikiArticle::STATUS_PUBLISHED,
            'published_at' => $article->published_at ?? now(),
            'version' => (int) $article->version + 1,
        ])->save();

        return $article;
    }

    public function archive(WikiArticle $article): WikiArticle
    {
        $article->forceFill([
            'status' => WikiArticle::STATUS_ARCHIVED,
            'version' => (int) $article->version + 1,
        ])->save();

        return $article;
    }

    /** شمارش بازدید — افزایش اتمی، بدون نوشتن مقدار از کلاینت. */
    public function recordView(WikiArticle $article): void
    {
        WikiArticle::query()
            ->whereKey($article->getKey())
            ->increment('view_count');
    }

    private function categoryId(mixed $categoryId): ?string
    {
        if ($categoryId === null || $categoryId === '') {
            return null;
        }

        $exists = WikiCategory::query()->whereKey((string) $categoryId)->exists();

        if (! $exists) {
            throw new ApiErrorException(
                'CATEGORY_NOT_FOUND',
                422,
                'The selected category does not exist.',
                ['categoryId' => ['CATEGORY_NOT_FOUND']],
            );
        }

        return (string) $categoryId;
    }

    private function slug(string $slug, ?WikiArticle $ignore): string
    {
        $slug = PersianText::slugify($slug);

        if ($slug === '') {
            throw new ApiErrorException('ARTICLE_SLUG_INVALID', 422, 'Article slug is invalid.', ['slug' => ['ARTICLE_SLUG_INVALID']]);
        }

        $exists = WikiArticle::query()
            ->where('slug', $slug)
            ->when($ignore !== null, fn (Builder $query) => $query->whereKeyNot($ignore->getKey()))
            ->exists();

        if ($exists) {
            throw new ApiErrorException('ARTICLE_SLUG_TAKEN', 409, 'This article slug is already used.', ['slug' => ['ARTICLE_SLUG_TAKEN']]);
        }

        return $slug;
    }

    private function title(string $title): string
    {
        $clean = $this->sanitizer->toPlainText($title) ?? '';

        if ($clean === '') {
            throw new ApiErrorException('ARTICLE_TITLE_REQUIRED', 422, 'Article title is required.', ['title' => ['ARTICLE_TITLE_REQUIRED']]);
        }

        return $clean;
    }

    private function body(string $body): string
    {
        $raw = (string) $body;

        if (trim($raw) === '') {
            throw new ApiErrorException('ARTICLE_BODY_REQUIRED', 422, 'Article body is required.', ['body' => ['ARTICLE_BODY_REQUIRED']]);
        }

        if (mb_strlen($raw) > (int) config('wiki.sanitize.max_input_length')) {
            throw new ApiErrorException('ARTICLE_BODY_TOO_LARGE', 422, 'Article body is too large.', ['body' => ['ARTICLE_BODY_TOO_LARGE']]);
        }

        if (! (bool) config('wiki.sanitize.enabled', true)) {
            return $raw;
        }

        return $this->sanitizer->sanitize($raw, 'rich') ?? '';
    }

    private function plain(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $this->sanitizer->toPlainText((string) $value);
    }

    /** @return list<string>|null */
    private function facts(mixed $facts): ?array
    {
        if (! is_array($facts)) {
            return null;
        }

        $clean = [];

        foreach (array_slice($facts, 0, (int) config('wiki.articles.max_key_facts')) as $fact) {
            if (! is_string($fact)) {
                continue;
            }

            $text = $this->sanitizer->toPlainText($fact) ?? '';

            if ($text !== '') {
                $clean[] = $text;
            }
        }

        return $clean === [] ? null : $clean;
    }

    /** @return list<string>|null */
    private function keywords(mixed $keywords): ?array
    {
        if (! is_array($keywords)) {
            return null;
        }

        $clean = [];

        foreach (array_slice($keywords, 0, (int) config('wiki.articles.max_keywords')) as $keyword) {
            if (! is_string($keyword)) {
                continue;
            }

            $text = $this->sanitizer->toPlainText($keyword) ?? '';

            if ($text !== '') {
                $clean[] = $text;
            }
        }

        return $clean === [] ? null : array_values(array_unique($clean));
    }
}
