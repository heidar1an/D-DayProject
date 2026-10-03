<?php

namespace App\Services\Wiki;

use App\Models\WikiArticle;
use App\Models\WikiRelation;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * خواندن مقاله — بدون نویسندگی.
 *
 * قاعدهٔ مرکزی (§29 و §39): **`published` تنها وضعیتی است که از مسیر عمومی
 * دیده می‌شود.** `draft` و `archived` در هیچ کوئری این سرویس نیستند و شناسهٔ
 * آن‌ها هم پاسخ نمی‌دهد (۴۰۴)، نه ۴۰۳ — وجودشان نباید لو برود.
 */
class WikiQueryService
{
    public const SORTS = ['popular', 'recent', 'title'];

    /** فیلترهای مجاز عمومی — آینهٔ `browseWiki` در UI. */
    public const FILTERS = ['q', 'subject', 'type', 'difficulty', 'categoryId', 'sort', 'page', 'perPage'];

    /**
     * فهرست مقاله‌های منتشرشده.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, WikiArticle>
     */
    public function published(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = $this->publishedQuery();

        $this->applyFilters($query, $filters);

        return $this->applySort($query, $filters['sort'] ?? null)
            ->with('category:id,slug,name')
            ->paginate($perPage);
    }

    /** مقالهٔ منتشرشده بر اساس slug — پیش‌نویس/آرشیو `null` می‌دهد. */
    public function publishedBySlug(string $slug): ?WikiArticle
    {
        return $this->publishedQuery()
            ->where('slug', $slug)
            ->with('category:id,slug,name')
            ->first();
    }

    /**
     * مقالهٔ منتشرشده بر اساس شناسه — برای نشان‌گذاری.
     *
     * شناسه روی مسیر با `whereUuid` قید دارد؛ دلیلش درس فاز ۷ است: ستون `id` در
     * PostgreSQL از نوع `uuid` است و مقایسه با رشتهٔ دلخواه `SQLSTATE[22P02]` و
     * **۵۰۰ به‌جای ۴۰۴** می‌دهد.
     */
    public function publishedById(string $id): ?WikiArticle
    {
        return $this->publishedQuery()->whereKey($id)->first();
    }

    /**
     * رابطه‌های یک مقاله برای نمایش عمومی.
     *
     * خروجی دو بخش دارد (مثل UI فعلی):
     *   `related`   = رابطه‌های خروجی به مقالهٔ منتشرشده
     *   `backlinks` = مقاله‌های منتشرشده‌ای که به این مقاله اشاره کرده‌اند و در
     *                 `related` تکرار نشده‌اند.
     *
     * @return array{related: list<array<string, mixed>>, backlinks: list<array<string, mixed>>}
     */
    public function relations(WikiArticle $article): array
    {
        $outgoing = WikiRelation::query()
            ->where('from_article_id', $article->getKey())
            ->whereHas('toArticle', fn (Builder $query) => $query->where('status', WikiArticle::STATUS_PUBLISHED))
            ->with(['toArticle' => fn ($query) => $query->where('status', WikiArticle::STATUS_PUBLISHED)])
            ->limit((int) config('wiki.relations.max_per_article'))
            ->get();

        $related = [];
        $seen = [];

        foreach ($outgoing as $relation) {
            $target = $relation->toArticle;

            if (! $target instanceof WikiArticle) {
                continue;
            }

            $seen[(string) $target->getKey()] = true;
            $related[] = $this->relationRow($target, (string) $relation->kind, false);
        }

        $incoming = WikiRelation::query()
            ->where('to_article_id', $article->getKey())
            ->whereHas('fromArticle', fn (Builder $query) => $query->where('status', WikiArticle::STATUS_PUBLISHED))
            ->with(['fromArticle' => fn ($query) => $query->where('status', WikiArticle::STATUS_PUBLISHED)])
            ->limit((int) config('wiki.relations.max_per_article'))
            ->get();

        $backlinks = [];

        foreach ($incoming as $relation) {
            $source = $relation->fromArticle;

            if (! $source instanceof WikiArticle || isset($seen[(string) $source->getKey()])) {
                continue;
            }

            $backlinks[] = $this->relationRow($source, (string) $relation->kind, true);
        }

        return ['related' => $related, 'backlinks' => $backlinks];
    }

    /**
     * فهرست مقاله‌ها در پنل — همهٔ وضعیت‌ها.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, WikiArticle>
     */
    public function adminList(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = WikiArticle::query()->with('category:id,slug,name');

        if (isset($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        if (isset($filters['categoryId'])) {
            $query->where('category_id', (string) $filters['categoryId']);
        }

        $this->applyFilters($query, $filters);

        return $query->orderByDesc('updated_at')->paginate($perPage);
    }

    public function adminFind(string $id): ?WikiArticle
    {
        return WikiArticle::query()->whereKey($id)->with('category:id,slug,name')->first();
    }

    /** @return Builder<WikiArticle> */
    private function publishedQuery(): Builder
    {
        return WikiArticle::query()->where('status', WikiArticle::STATUS_PUBLISHED);
    }

    /**
     * فیلترهای مشترک عمومی/پنل. `q` نرمال‌سازی‌شده اعمال می‌شود.
     *
     * @param  Builder<WikiArticle>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (isset($filters['subject'])) {
            $query->where('subject', (string) $filters['subject']);
        }

        if (isset($filters['type'])) {
            $query->where('content_type', (string) $filters['type']);
        }

        if (isset($filters['difficulty'])) {
            $query->where('difficulty', (string) $filters['difficulty']);
        }

        if (isset($filters['categoryId'])) {
            $query->where('category_id', (string) $filters['categoryId']);
        }

        if (isset($filters['q']) && trim((string) $filters['q']) !== '') {
            WikiSearchService::applyTextSearch($query, (string) $filters['q']);
        }
    }

    /**
     * @param  Builder<WikiArticle>  $query
     * @return Builder<WikiArticle>
     */
    private function applySort(Builder $query, mixed $sort): Builder
    {
        return match ($sort) {
            'recent' => $query->orderByDesc('published_at')->orderByDesc('id'),
            'title' => $query->orderBy('title'),
            default => $query->orderByDesc('popularity')->orderByDesc('id'),
        };
    }

    /** @return array<string, mixed> */
    private function relationRow(WikiArticle $article, string $kind, bool $backlink): array
    {
        return [
            'article_id' => $article->getKey(),
            'slug' => $article->slug,
            'title' => $article->title,
            'summary' => $article->summary,
            'subject' => $article->subject,
            'content_type' => $article->content_type,
            'difficulty' => $article->difficulty,
            'kind' => $kind,
            'kind_label' => $this->kindLabel($kind),
            'direction' => $backlink ? 'incoming' : 'outgoing',
        ];
    }

    private function kindLabel(string $kind): string
    {
        /** @var array<string, string> $labels */
        $labels = [
            'related_to' => 'مرتبط با',
            'regulates' => 'تنظیم می‌کند',
            'regulated_by' => 'تنظیم‌شده توسط',
            'part_of' => 'بخشی از',
            'contains' => 'شامل',
            'produces' => 'تولید می‌کند',
            'causes' => 'موجب',
            'caused_by' => 'ناشی از',
            'treated_by' => 'درمان با',
            'measured_by' => 'سنجیده با',
            'measures' => 'می‌سنجد',
        ];

        return $labels[$kind] ?? $kind;
    }
}
