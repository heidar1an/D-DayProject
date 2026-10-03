<?php

namespace App\Support\Idempotency;

/**
 * نتیجهٔ یک عملیات idempotent.
 *
 * `replayed = true` یعنی این پاسخ از ledger بازپخش شده و عملیات دامنه **دوباره
 * اجرا نشده** — همان چیزی که جلوی سه‌برابر شدن `seconds_spent` یا ساخت Attempt
 * دوم را می‌گیرد.
 */
final readonly class IdempotencyOutcome
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>|null  $meta
     */
    public function __construct(
        public bool $replayed,
        public int $status,
        public array $data,
        public ?array $meta = null,
    ) {}
}
