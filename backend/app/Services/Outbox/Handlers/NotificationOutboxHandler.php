<?php

namespace App\Services\Outbox\Handlers;

use App\Models\OutboxEvent;
use App\Services\Notifications\NotificationService;
use App\Services\Notifications\NotificationTypeRegistry;
use InvalidArgumentException;

/**
 * handler رخدادهای اعلان — فاز ۱۹.
 *
 *   Domain Event → Outbox (notification.*) → این handler → NotificationService
 *
 * payload فقط `{userId, ...}` را حمل می‌کند (§17) و `dedup_key` از `event_key`
 * می‌آید، پس تحویل دوبارهٔ همان رخداد اعلان تکراری نمی‌سازد (§27).
 */
final class NotificationOutboxHandler implements OutboxHandler
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly NotificationTypeRegistry $types,
    ) {}

    public function handle(OutboxEvent $event): void
    {
        $payload = (array) $event->payload;
        $userId = $payload['userId'] ?? null;

        if (! is_string($userId) || $userId === '') {
            throw new InvalidArgumentException('Notification outbox event has no userId.');
        }

        $type = $this->types->fromEventType((string) $event->event_type);

        /* `userId` بخشی از payload اعلان نیست؛ فقط مسیر تحویل را تعیین می‌کند. */
        unset($payload['userId']);

        $this->notifications->create($userId, $type, $payload, (string) $event->event_key);
    }
}
