<?php

namespace App\Services\Articles;

use App\Models\Article;
use App\Models\ArticleCategory;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * کوئری عمومی Article — فاز ۱۶ (§27).
 *
 * فقط `published` (draft/archived ⇒ ۴۰۴ در همان کوئری). Sorting allowlist از
 * config است و کلاینت نمی‌تواند ستون دلخواه بفرستد.
 */
final class ArticleQueryService
{
    /** @return LengthAwarePaginator<int, Article> */
    public function published(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = Article::query()
            ->where('status', Article::STATUS_PUBLISHED)
            ->with('category:id,slug,name');

        if (! empty($filters['categoryId'])) {
            $query->where('category_id', $filters['categoryId']);
        }

        if (! empty($filters['category'])) {
            $query->whereHas('category', fn ($q) => $q->where('slug', (string) $filters['category']));
        }

        $query = match ((string) ($filters['sort'] ?? 'latest')) {
            default => $query->orderByDesc('published_at')->orderByDesc('id'),
        };

        return $query->paginate($perPage);
    }

    public function publishedBySlug(string $slug): ?Article
    {
        /** @var Article|null */
        return Article::query()
            ->where('status', Article::STATUS_PUBLISHED)
            ->where('slug', $slug)
            ->with('category:id,slug,name')
            ->first();
    }

    /**
     * دسته‌های منتشرشده با شمار مقالهٔ منتشرشده — برای فیلتر UI.
     *
     * @return array<int, ArticleCategory>
     */
    public function publishedCategories(): array
    {
        return ArticleCategory::query()
            ->where('status', ArticleCategory::STATUS_PUBLISHED)
            ->withCount(['articles' => fn ($q) => $q->where('status', Article::STATUS_PUBLISHED)])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->all();
    }
}
