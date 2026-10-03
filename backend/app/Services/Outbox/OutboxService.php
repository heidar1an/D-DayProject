<?php

namespace App\Services\Outbox;

use App\Jobs\ProcessOutboxEventJob;
use App\Models\OutboxEvent;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use JsonException;

/**
 * ثبت رخداد در Outbox — فاز ۱۹.
 *
 * قرارداد: **اول دامنه commit، بعد رخداد ثبت می‌شود** (§117). listenerهای
 * این پروژه `ShouldHandleEventsAfterCommit` هستند، پس این سرویس هرگز وسط
 * تراکنش دامنه صدا زده نمی‌شود.
 *
 * Idempotent: `event_key` یکتاست؛ فراخوانی دوباره با همان کلید رکورد دوم
 * نمی‌سازد و `null` برمی‌گرداند (§13).
 */
class OutboxService
{
    /**
     * @param  array<string, mixed>  $payload  حداقل دادهٔ لازم — بدون رمز/توکن
     */
    public function record(
        string $eventKey,
        string $aggregateType,
        string $aggregateId,
        string $eventType,
        array $payload,
        bool $dispatch = true,
    ): ?OutboxEvent {
        $this->assertKnownEventType($eventType);
        $this->assertPayloadSize($payload);

        /*
         * ⚠️ `DB::transaction` + گرفتن استثنا در **بیرون** آن.
         *
         * روی PostgreSQL هر دستورِ خطادار کل تراکنش جاری را aborted می‌کند. اگر
         * خطا را داخل callback بگیریم، لاراول کار را موفق می‌بیند و rollback
         * نمی‌کند ⇒ هر دستور بعدی با `25P02` می‌شکند (روی SQLite اثری ندارد و
         * باگ دیده نمی‌شود). با گرفتن بیرونی، rollback تا savepoint انجام می‌شود.
         */
        try {
            $event = DB::transaction(function () use ($eventKey, $aggregateType, $aggregateId, $eventType, $payload): OutboxEvent {
                $row = new OutboxEvent;
                $row->forceFill([
                    'event_key' => mb_substr($eventKey, 0, 190),
                    'aggregate_type' => mb_substr($aggregateType, 0, 64),
                    'aggregate_id' => mb_substr($aggregateId, 0, 64),
                    'event_type' => mb_substr($eventType, 0, 96),
                    'payload' => $payload,
                    'attempts' => 0,
                ])->save();

                return $row;
            });
        } catch (UniqueConstraintViolationException) {
            /* همان رخداد قبلاً ثبت شده — دوباره منتشر نمی‌شود. */
            return null;
        }

        if ($dispatch) {
            /* afterCommit: اگر روزی این متد داخل تراکنش صدا زده شد، Job قبل از
             * commit به صف نرود. */
            ProcessOutboxEventJob::dispatch((string) $event->getKey())->afterCommit();
        }

        return $event;
    }

    /**
     * ثبت چند رخداد در یک فراخوانی — ترتیب حفظ می‌شود.
     *
     * @param  list<array{eventKey:string, aggregateType:string, aggregateId:string, eventType:string, payload:array<string,mixed>}>  $events
     * @return list<OutboxEvent>
     */
    public function recordMany(array $events, bool $dispatch = true): array
    {
        $recorded = [];

        foreach ($events as $event) {
            $row = $this->record(
                $event['eventKey'],
                $event['aggregateType'],
                $event['aggregateId'],
                $event['eventType'],
                $event['payload'],
                $dispatch,
            );

            if ($row !== null) {
                $recorded[] = $row;
            }
        }

        return $recorded;
    }

    private function assertKnownEventType(string $eventType): void
    {
        /*
         * ⚠️ کلیدهای نگاشت نقطه دارند (`search.index`) ⇒ dot-notation آن‌ها را
         * تودرتو می‌خواند و همیشه null می‌دهد. فقط دسترسی آرایه‌ای درست است.
         */
        $handlers = (array) config('outbox.handlers', []);

        if (! is_string($handlers[$eventType] ?? null)) {
            throw new InvalidArgumentException('Unknown outbox event type: '.$eventType);
        }
    }

    /** @param array<string, mixed> $payload */
    private function assertPayloadSize(array $payload): void
    {
        try {
            $encoded = json_encode($payload, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new InvalidArgumentException('Outbox payload is not JSON-serializable.', 0, $error);
        }

        $max = (int) config('outbox.payload_max_bytes');

        if ($max > 0 && strlen($encoded) > $max) {
            throw new InvalidArgumentException('Outbox payload exceeds the configured maximum size.');
        }
    }
}
