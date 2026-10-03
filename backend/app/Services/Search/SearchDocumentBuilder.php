<?php

namespace App\Services\Search;

use App\Models\Article;
use App\Models\Course;
use App\Models\KnowledgeNode;
use App\Models\Lesson;
use App\Models\Reference;
use App\Models\WikiArticle;
use App\Support\Search\SearchNormalizer;
use Illuminate\Support\Facades\DB;

/**
 * ساخت سند جست‌وجو از دامنه — فاز ۱۹ (§32).
 *
 * دامنه منبع حقیقت است؛ این سرویس فقط **پروجکشن** می‌سازد. سند فقط برای
 * محتوای `published` ساخته می‌شود (§34) و برای هر دامنه یک query محدود و
 * index-دار اجرا می‌شود.
 */
final class SearchDocumentBuilder
{
    private const PUBLISHED = 'published';

    /**
     * نگاشت دامنه ⇒ [مدل، ستون‌های متن، برچسب].
     *
     * @var array<string, array{model: class-string, title: string, body: list<string>, route: string}>
     */
    private const MAP = [
        'course' => ['model' => Course::class, 'title' => 'title', 'body' => ['description'], 'route' => 'courses.show'],
        'lesson' => ['model' => Lesson::class, 'title' => 'title', 'body' => ['description'], 'route' => 'lessons.show'],
        'wiki_article' => ['model' => WikiArticle::class, 'title' => 'title', 'body' => ['summary', 'body'], 'route' => 'wiki.articles.show'],
        'article' => ['model' => Article::class, 'title' => 'title', 'body' => ['summary', 'body'], 'route' => 'articles.show'],
        'reference' => ['model' => Reference::class, 'title' => 'title', 'body' => ['description'], 'route' => 'references.show'],
        'knowledge_node' => ['model' => KnowledgeNode::class, 'title' => 'label', 'body' => ['kind'], 'route' => 'knowledge.nodes.show'],
    ];

    public function supports(string $entityType): bool
    {
        return isset(self::MAP[$entityType]) && array_key_exists($entityType, (array) config('search.domains', []));
    }

    /** @return list<string> */
    public function entityTypes(): array
    {
        return array_values(array_filter(
            array_keys(self::MAP),
            fn (string $type): bool => $this->supports($type),
        ));
    }

    public function label(string $entityType): string
    {
        return (string) (config('search.domains.'.$entityType.'.label') ?? $entityType);
    }

    public function priority(string $entityType): int
    {
        return (int) (config('search.domains.'.$entityType.'.priority') ?? 0);
    }

    /**
     * ساخت متن سند — `null` یعنی «منتشر نشده یا وجود ندارد» و باید از ایندکس
     * حذف شود.
     *
     * @return array{title: string, body: string}|null
     */
    public function build(string $entityType, string $entityId): ?array
    {
        if (! $this->supports($entityType)) {
            return null;
        }

        $definition = self::MAP[$entityType];

        /** @var object|null $model */
        $model = $definition['model']::query()
            ->whereKey($entityId)
            ->where('status', self::PUBLISHED)
            ->first();

        if ($model === null) {
            return null;
        }

        $title = (string) ($model->{$definition['title']} ?? '');
        $parts = [];

        foreach ($definition['body'] as $column) {
            $value = $model->{$column} ?? null;

            if (is_string($value) && $value !== '') {
                $parts[] = $value;
            }
        }

        return [
            'title' => mb_substr($title, 0, (int) config('search.limits.title_max')),
            'body' => mb_substr(implode(' ', $parts), 0, (int) config('search.limits.body_max')),
        ];
    }

    /**
     * زیرمجموعهٔ **منتشرشدهٔ** شناسه‌های داده‌شده — دفاع دوم کوئری (§34).
     *
     * چرا لازم است: ایندکس ممکن است کهنه باشد (رخداد حذف گم شده باشد). این
     * فیلتر تضمین می‌کند پیش‌نویس/آرشیو هرگز از مسیر جست‌وجو بیرون نزند.
     *
     * @param  list<string>  $ids
     * @return list<string>
     */
    public function publishedIds(string $entityType, array $ids): array
    {
        if ($ids === [] || ! $this->supports($entityType)) {
            return [];
        }

        $model = self::MAP[$entityType]['model'];

        return $model::query()
            ->whereIn('id', $ids)
            ->where('status', self::PUBLISHED)
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id)
            ->all();
    }

    /**
     * شناسه‌های منتشرشدهٔ یک دامنه برای Rebuild — cursor-based و bounded.
     *
     * @return list<string>
     */
    public function publishedIdsBatch(string $entityType, ?string $afterId, int $limit): array
    {
        if (! $this->supports($entityType)) {
            return [];
        }

        $model = self::MAP[$entityType]['model'];

        $query = $model::query()->where('status', self::PUBLISHED);

        if ($afterId !== null && $afterId !== '') {
            $query->where('id', '>', $afterId);
        }

        return $query->orderBy('id')->limit($limit)->pluck('id')
            ->map(static fn ($id): string => (string) $id)
            ->all();
    }

    public function countPublished(string $entityType): int
    {
        if (! $this->supports($entityType)) {
            return 0;
        }

        $model = self::MAP[$entityType]['model'];

        return (int) $model::query()->where('status', self::PUBLISHED)->count();
    }

    /** مسیر عمومی نتیجه — از config مسیرها خوانده می‌شود، نه ساخته‌شدن در UI. */
    public function routeName(string $entityType): ?string
    {
        return self::MAP[$entityType]['route'] ?? null;
    }

    /** شناسهٔ دامنه از روی سند — برای حذف دسته‌ای (archive/delete). */
    public function removeForEntity(string $entityType, string $entityId): int
    {
        return DB::table('search_documents')
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->delete();
    }

    public function normalizedText(string $title, string $body): string
    {
        return SearchNormalizer::normalize($title.' '.$body);
    }
}
