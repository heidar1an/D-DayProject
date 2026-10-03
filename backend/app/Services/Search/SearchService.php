<?php

namespace App\Services\Search;

use App\Support\Search\SearchNormalizer;
use Illuminate\Support\Facades\DB;

/**
 * کوئری جست‌وجو — فاز ۱۹ (§37/§38/§39/§42/§43).
 *
 * چهار تضمین:
 *   ۱) فقط توکن‌های سانیتایز به عبارت FTS می‌روند (سد تزریق).
 *   ۲) سقف نامزد (`max_candidates`) ⇒ «unbounded query» ممکن نیست.
 *   ۳) هر نامزد یک بار دیگر با سیاست دسترسی دامنه چک می‌شود ⇒ پیش‌نویس/آرشیو
 *      حتی با ایندکس کهنه بیرون نمی‌زند (§34).
 *   ۴) رتبه‌بندی deterministic و ساده است، نه ML (§38).
 */
final class SearchService
{
    public function __construct(
        private readonly SearchDocumentBuilder $builder,
    ) {}

    /**
     * @return array{items: list<array<string, mixed>>, total: int, page: int, perPage: int, lastPage: int, candidateCapped: bool}
     */
    public function search(string $query, ?string $type, string $sort, int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = max(1, $perPage);

        $tokens = SearchNormalizer::tokens($query);

        if ($tokens === []) {
            return $this->emptyResult($page, $perPage);
        }

        $types = $this->resolveTypes($type);
        $maxCandidates = max(1, (int) config('search.query.max_candidates'));

        $candidates = $this->candidates($query, $types, $maxCandidates);

        /* ── فیلتر دسترسی: دفاع دوم §34 ─────────────────────────────── */
        $byType = [];

        foreach ($candidates as $candidate) {
            $byType[$candidate['entity_type']][] = $candidate['entity_id'];
        }

        $allowed = [];

        foreach ($byType as $entityType => $ids) {
            foreach ($this->builder->publishedIds($entityType, array_values(array_unique($ids))) as $id) {
                $allowed[$entityType.'|'.$id] = true;
            }
        }

        $filtered = array_values(array_filter(
            $candidates,
            fn (array $candidate): bool => isset($allowed[$candidate['entity_type'].'|'.$candidate['entity_id']]),
        ));

        foreach ($filtered as $index => $candidate) {
            $filtered[$index]['priority'] = $this->builder->priority($candidate['entity_type']);
            $filtered[$index]['score'] = $this->score($candidate, $tokens, $sort);
        }

        usort($filtered, function (array $a, array $b): int {
            return [$b['score'], $b['priority'], $a['entity_type'], $a['entity_id']]
                <=> [$a['score'], $a['priority'], $b['entity_type'], $b['entity_id']];
        });

        $total = count($filtered);
        $offset = ($page - 1) * $perPage;
        $pageItems = array_slice($filtered, $offset, $perPage);

        $items = array_map(function (array $candidate) use ($tokens): array {
            return [
                'entityType' => $candidate['entity_type'],
                'entityId' => (string) $candidate['entity_id'],
                'label' => $this->builder->label($candidate['entity_type']),
                'title' => (string) $candidate['title'],
                'snippet' => SearchNormalizer::snippet((string) $candidate['body'], $tokens),
            ];
        }, $pageItems);

        return [
            'items' => array_values($items),
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'lastPage' => $total === 0 ? 1 : (int) ceil($total / $perPage),
            'candidateCapped' => count($candidates) >= $maxCandidates,
        ];
    }

    /** @return list<string> */
    public function searchableTypes(): array
    {
        return $this->builder->entityTypes();
    }

    /**
     * نامزدهای FTS — یک query، bounded و پارامتری.
     *
     * @param  list<string>  $types
     * @return list<array{entity_type: string, entity_id: string, title: string, body: string, rank: float}>
     */
    private function candidates(string $query, array $types, int $limit): array
    {
        $typePlaceholders = implode(', ', array_fill(0, max(1, count($types)), '?'));
        $typeFilter = $types === [] ? '' : " AND entity_type IN ({$typePlaceholders})";

        if (DB::connection()->getDriverName() === 'pgsql') {
            $tsQuery = SearchNormalizer::tsQuery($query);

            if ($tsQuery === null) {
                return [];
            }

            $sql = "SELECT entity_type, entity_id, title, body, ts_rank(document, q) AS rank
                    FROM search_documents, to_tsquery('simple', ?) AS q
                    WHERE document @@ q{$typeFilter}
                    ORDER BY rank DESC, entity_type, entity_id
                    LIMIT ?";

            $bindings = array_merge([$tsQuery], $types, [$limit]);

            return array_map(
                static fn ($row): array => (array) $row,
                DB::select($sql, $bindings),
            );
        }

        /* SQLite: همهٔ توکن‌ها باید باشند (AND) — همان معنای `&` در tsquery. */
        $patterns = SearchNormalizer::likePatterns($query);

        if ($patterns === []) {
            return [];
        }

        $likeClause = implode(' AND ', array_fill(0, count($patterns), 'document_text LIKE ?'));
        $sql = "SELECT entity_type, entity_id, title, body, 0 AS rank
                FROM search_documents
                WHERE {$likeClause}{$typeFilter}
                ORDER BY entity_type, entity_id
                LIMIT ?";

        $bindings = array_merge($patterns, $types, [$limit]);

        $rows = DB::select($sql, $bindings);

        /* رتبه‌بندی شفاف برای درایور بدون ts_rank: فراوانی توکن‌ها در سند. */
        return array_map(function ($row) use ($patterns): array {
            $document = SearchNormalizer::normalize((string) $row->title.' '.(string) $row->body);
            $rank = 0;

            foreach ($patterns as $pattern) {
                $token = trim($pattern, '%');
                $rank += substr_count($document, $token);
            }

            return [
                'entity_type' => (string) $row->entity_type,
                'entity_id' => (string) $row->entity_id,
                'title' => (string) $row->title,
                'body' => (string) $row->body,
                'rank' => (float) $rank,
            ];
        }, $rows);
    }

    /**
     * امتیاز نهایی deterministic: رتبهٔ متن × وزن + اولویت دامنه (§38).
     *
     * @param  array<string, mixed>  $candidate
     * @param  list<string>  $tokens
     */
    private function score(array $candidate, array $tokens, string $sort): float
    {
        if ($sort === 'latest') {
            return 0.0; /* ترتیب متأخر با `id` تثبیت می‌شود؛ امتیاز یکنواخت. */
        }

        $textRank = (float) ($candidate['rank'] ?? 0);
        $titleHit = 0;

        foreach ($tokens as $token) {
            if (mb_strpos(SearchNormalizer::normalize((string) $candidate['title']), $token) !== false) {
                $titleHit++;
            }
        }

        return $textRank + ($titleHit * 10);
    }

    /** @return list<string> */
    private function resolveTypes(?string $type): array
    {
        if ($type === null || $type === '') {
            return $this->builder->entityTypes();
        }

        return $this->builder->supports($type) ? [$type] : [];
    }

    /** @return array{items: list<array<string, mixed>>, total: int, page: int, perPage: int, lastPage: int, candidateCapped: bool} */
    private function emptyResult(int $page, int $perPage): array
    {
        return [
            'items' => [],
            'total' => 0,
            'page' => $page,
            'perPage' => $perPage,
            'lastPage' => 1,
            'candidateCapped' => false,
        ];
    }
}
