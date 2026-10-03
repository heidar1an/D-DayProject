<?php

namespace App\Services\Outbox\Handlers;

use App\Models\OutboxEvent;
use App\Services\Search\SearchIndexer;
use InvalidArgumentException;

/**
 * handler رخدادهای ایندکس جست‌وجو — فاز ۱۹ (§40).
 *
 *   Domain Change → Outbox (search.index|search.remove) → این handler → Index
 *
 * Idempotent: upsert روی `UNIQUE(entity_type, entity_id)` و حذف idempotent است.
 * `search.index` روی محتوای منتشرنشده خودش به حذف تبدیل می‌شود (سند نباید
 * بماند)، پس انتشار دوبارهٔ رخداد وضعیت درست را نتیجه می‌دهد.
 */
final class SearchOutboxHandler implements OutboxHandler
{
    public function __construct(
        private readonly SearchIndexer $indexer,
    ) {}

    public function handle(OutboxEvent $event): void
    {
        $payload = (array) $event->payload;
        $entityType = $payload['entityType'] ?? null;
        $entityId = $payload['entityId'] ?? null;

        if (! is_string($entityType) || $entityType === '' || ! is_string($entityId) || $entityId === '') {
            throw new InvalidArgumentException('Search outbox event requires entityType and entityId.');
        }

        if ($event->event_type === 'search.remove') {
            $this->indexer->remove($entityType, $entityId);

            return;
        }

        $this->indexer->index($entityType, $entityId);
    }
}
