<?php

namespace App\Jobs;

use App\Services\Search\SearchIndexer;
use Illuminate\Support\Facades\Log;

/**
 * بازسازی ایندکس جست‌وجو — فاز ۱۹ (§41/§89/§102).
 *
 * از پنل (`POST /admin/search/rebuild`) صف می‌شود تا درخواست HTTP طولانی
 * نشود. Rebuild **derived** است و هیچ دادهٔ دامنه را تغییر نمی‌دهد.
 */
final class RebuildSearchIndexJob extends TapeshJob
{
    public function __construct(
        private readonly ?string $entityType = null,
    ) {
        parent::__construct();
    }

    protected function policyKey(): string
    {
        return 'search';
    }

    protected function queueName(): string
    {
        return (string) config('search.indexing.queue', 'search');
    }

    public function handle(SearchIndexer $indexer): void
    {
        $startedAt = microtime(true);
        $indexed = $indexer->rebuild($this->entityType);

        Log::info('search.rebuild', [
            'entity_type' => $this->entityType ?? 'all',
            'indexed' => $indexed,
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);
    }
}
