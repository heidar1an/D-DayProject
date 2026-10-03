<?php

namespace App\Services\Search;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * ایندکس‌گذاری جست‌وجو — فاز ۱۹ (§32/§40/§41).
 *
 * Idempotent: upsert روی `UNIQUE(entity_type, entity_id)`، پس اجرای دوبارهٔ Job
 * سند تکراری نمی‌سازد. دامنهٔ نامعتبر **استثنا** می‌دهد تا خطای پیکربندی
 * بی‌صدا رد نشود.
 *
 * `document_text` (متن نرمال‌شدهٔ فارسی) روی هر دو درایور نوشته می‌شود؛ ستون
 * `document` روی PostgreSQL **generated** است و هرگز در insert/update نمی‌آید.
 */
final class SearchIndexer
{
    public function __construct(
        private readonly SearchDocumentBuilder $builder,
    ) {}

    public function index(string $entityType, string $entityId): bool
    {
        if (! $this->builder->supports($entityType)) {
            throw new InvalidArgumentException('Unsupported search entity type: '.$entityType);
        }

        $document = $this->builder->build($entityType, $entityId);

        if ($document === null) {
            /* منتشرنشده/حذف‌شده ⇒ سند نباید در ایندکس بماند (§40). */
            $this->remove($entityType, $entityId);

            return false;
        }

        $now = now();
        $row = [
            'id' => (string) Str::uuid(),
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'title' => $document['title'],
            'body' => $document['body'],
            /*
             * متن نرمال‌شدهٔ فارسی — منبع **هر دو** مسیر کوئری: روی PG ستون
             * generated `document` (tsvector) از همین ساخته می‌شود و روی SQLite
             * کوئری با `LIKE` روی همین ستون می‌رود. نرمال‌سازی اینجا انجام
             * می‌شود تا رفتار production و تست یکی باشد.
             */
            'document_text' => $this->builder->normalizedText($document['title'], $document['body']),
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $update = ['title', 'body', 'document_text', 'updated_at'];

        DB::table('search_documents')->upsert([$row], ['entity_type', 'entity_id'], $update);

        return true;
    }

    public function remove(string $entityType, string $entityId): int
    {
        return $this->builder->removeForEntity($entityType, $entityId);
    }

    /**
     * بازسازی کامل ایندکس — cursor-based و chunked؛ هیچ‌جا همهٔ رکوردها در
     * حافظه جمع نمی‌شوند (§41).
     *
     * @param  callable(string, int):void|null  $progress
     * @return array<string, int> تعداد سند ایندکس‌شده به‌ازای هر دامنه
     */
    public function rebuild(?string $entityType = null, ?callable $progress = null): array
    {
        $types = $entityType !== null && $entityType !== ''
            ? [$entityType]
            : $this->builder->entityTypes();

        $batch = (int) config('search.indexing.batch');
        $indexed = [];

        foreach ($types as $type) {
            if (! $this->builder->supports($type)) {
                throw new InvalidArgumentException('Unsupported search entity type: '.$type);
            }

            $count = 0;
            $cursor = null;

            do {
                $ids = $this->builder->publishedIdsBatch($type, $cursor, $batch);

                foreach ($ids as $id) {
                    if ($this->index($type, $id)) {
                        $count++;
                    }
                }

                $cursor = $ids === [] ? null : (string) end($ids);

                if ($progress !== null) {
                    $progress($type, $count);
                }
            } while ($cursor !== null);

            $this->removeStale($type);

            $indexed[$type] = $count;
        }

        return $indexed;
    }

    /**
     * حذف سندهای یتیم (منبع دیگر منتشرشده نیست) — تضمین دوم §34.
     */
    public function removeStale(string $entityType, int $chunk = 500): int
    {
        $removed = 0;

        do {
            $documentIds = DB::table('search_documents')
                ->where('entity_type', $entityType)
                ->orderBy('entity_id')
                ->limit($chunk)
                ->pluck('entity_id')
                ->map(static fn ($id): string => (string) $id)
                ->all();

            if ($documentIds === []) {
                break;
            }

            $published = $this->builder->publishedIds($entityType, $documentIds);
            $stale = array_values(array_diff($documentIds, $published));

            if ($stale !== []) {
                $removed += DB::table('search_documents')
                    ->where('entity_type', $entityType)
                    ->whereIn('entity_id', $stale)
                    ->delete();
            }

            /* پیشرفت بر اساس شناسه: سندهای باقی‌مانده دوباره خوانده نشوند. */
            if ($stale === [] && count($documentIds) >= $chunk) {
                DB::table('search_documents')
                    ->where('entity_type', $entityType)
                    ->whereIn('entity_id', $documentIds)
                    ->update(['updated_at' => now()]);
            }
        } while (count($documentIds) >= $chunk);

        return $removed;
    }

    /** @return array<string, array{indexed: int, published: int}> */
    public function status(): array
    {
        $status = [];

        foreach ($this->builder->entityTypes() as $type) {
            $status[$type] = [
                'indexed' => (int) DB::table('search_documents')->where('entity_type', $type)->count(),
                'published' => $this->builder->countPublished($type),
            ];
        }

        return $status;
    }
}
