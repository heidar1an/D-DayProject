<?php

namespace App\Services\Wiki;

use App\Models\WikiArticle;
use App\Support\Content\PersianText;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * جست‌وجو و پیشنهاد ویکی — **PostgreSQL/ILIKE**، نه موتور تخصصی (§30).
 *
 * چرا این کافی است: حجم محتوای ویکی در این فاز محدود است و Blueprint صریحاً
 * می‌گوید FTS/tsvector و adapter موتور جست‌وجو فاز زیرساختی بعدی است. تنها
 * نکتهٔ واقعیِ زبان فارسی، نرمال‌سازی حروف عربی/فارسی و نیم‌فاصله است که
 * `PersianText` انجام می‌دهد.
 *
 * امنیت (§39): هر کوئری از `published` شروع می‌شود. پیش‌نویس و آرشیو در هیچ
 * نتیجه‌ای — نه جست‌وجو، نه پیشنهاد، نه facet — دیده نمی‌شوند. همهٔ پارامترها
 * bind می‌شوند (`LIKE` با پارامتر، نه رشتهٔ چسبانده‌شده).
 */
class WikiSearchService
{
    /**
     * جست‌وجوی کامل با facet.
     *
     * @param  array<string, mixed>  $filters
     * @return array{results: LengthAwarePaginator<int, WikiArticle>, facets: array<string, array<string, int>>}
     */
    public function search(array $filters, int $perPage): array
    {
        $query = WikiArticle::query()->where('status', WikiArticle::STATUS_PUBLISHED);

        if (isset($filters['subject'])) {
            $query->where('subject', (string) $filters['subject']);
        }

        if (isset($filters['type'])) {
            $query->where('content_type', (string) $filters['type']);
        }

        if (isset($filters['difficulty'])) {
            $query->where('difficulty', (string) $filters['difficulty']);
        }

        $hasQuery = isset($filters['q']) && trim((string) $filters['q']) !== '';

        if ($hasQuery) {
            self::applyTextSearch($query, (string) $filters['q']);
        }

        // facet روی همان مجموعهٔ فیلترشده — نه کل دیتابیس.
        $facets = [
            'bySubject' => $this->facet(clone $query, 'subject'),
            'byType' => $this->facet(clone $query, 'content_type'),
            'byDifficulty' => $this->facet(clone $query, 'difficulty'),
        ];

        $results = match ($filters['sort'] ?? null) {
            'recent' => $query->orderByDesc('published_at')->orderByDesc('id'),
            'title' => $query->orderBy('title'),
            default => $query->orderByDesc('popularity')->orderByDesc('id'),
        };

        return [
            'results' => $results->with('category:id,slug,name')->paginate($perPage),
            'facets' => $facets,
        ];
    }

    /**
     * پیشنهاد زنده هنگام تایپ — **bounded** و سبک.
     *
     * فقط روی `title` و `slug` می‌گردد و سقف سخت دارد؛ autocomplete نباید کل
     * دیتابیس را برگرداند (§31). عبارت کوتاه‌تر از حد آستانه هیچ نتیجه‌ای
     * نمی‌دهد (نه اینکه همه‌چیز را برگرداند).
     *
     * @return list<array<string, mixed>>
     */
    public function suggest(string $query, int $limit): array
    {
        $limit = max(1, min($limit, (int) config('wiki.search.suggest_limit_max')));
        $variants = PersianText::searchVariants($query);

        if ($variants === []) {
            return [];
        }

        $articles = WikiArticle::query()
            ->where('status', WikiArticle::STATUS_PUBLISHED)
            ->where(function (Builder $builder) use ($variants): void {
                foreach ($variants as $variant) {
                    $needle = $this->like($variant);
                    $builder->orWhere('title', 'like', $needle)
                        ->orWhere('slug', 'like', $needle);
                }
            })
            ->orderByDesc('popularity')
            ->limit($limit)
            ->get(['id', 'slug', 'title', 'subject', 'content_type', 'difficulty', 'popularity']);

        $suggestions = [];

        foreach ($articles as $article) {
            $suggestions[] = [
                'id' => $article->getKey(),
                'slug' => $article->slug,
                'title' => $article->title,
                'subject' => $article->subject,
                'content_type' => $article->content_type,
                'difficulty' => $article->difficulty,
                'popularity' => (int) $article->popularity,
            ];
        }

        return $suggestions;
    }

    /**
     * اعمال جست‌وجوی متنی نرمال‌سازی‌شده روی یک کوئری — مشترک جست‌وجو و فهرست.
     *
     * دو نسخه از عبارت (`«نیم فاصله»` و `«نیمفاصله»`) با OR ترکیب می‌شوند تا
     * شکل نیم‌فاصله در متن ذخیره‌شده اهمیتی نداشته باشد. جست‌وجو روی
     * `title`/`summary`/`body` است؛ `keywords` (jsonb) در این فاز جست‌وجو
     * نمی‌شود تا نیازی به cast و ایندکس تخصصی نباشد.
     *
     * @param  Builder<WikiArticle>  $query
     */
    public static function applyTextSearch(Builder $query, string $term): void
    {
        $variants = PersianText::searchVariants($term);

        if ($variants === []) {
            return;
        }

        $query->where(function (Builder $builder) use ($variants): void {
            foreach ($variants as $variant) {
                $needle = self::likeStatic($variant);

                $builder->orWhere('title', 'like', $needle)
                    ->orWhere('summary', 'like', $needle)
                    ->orWhere('body', 'like', $needle);
            }
        });
    }

    /**
     * شمارش facet برای یک ستون — یک کوئری گروهی، نه N+1.
     *
     * @param  Builder<WikiArticle>  $query
     * @return array<string, int>
     */
    private function facet(Builder $query, string $column): array
    {
        /** @var array<string, int> $counts */
        $counts = $query
            ->whereNotNull($column)
            ->groupBy($column)
            ->selectRaw($column.' as facet_key, count(*) as aggregate')
            ->pluck('aggregate', 'facet_key')
            ->map(fn ($value): int => (int) $value)
            ->all();

        return $counts;
    }

    private function like(string $needle): string
    {
        return self::likeStatic($needle);
    }

    /** `%` و `_` کاربر نباید wildcard شوند. */
    private static function likeStatic(string $needle): string
    {
        return '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $needle).'%';
    }
}
