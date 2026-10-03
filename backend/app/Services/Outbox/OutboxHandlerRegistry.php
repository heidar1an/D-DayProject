<?php

namespace App\Services\Outbox;

use App\Services\Outbox\Handlers\OutboxHandler;

/**
 * نگاشت `event_type` ⇒ handler از `config/outbox.php` — فاز ۱۹.
 *
 * چرا registry و نه `match` در Job: افزودن نوع رخداد تازه نباید Job را تغییر
 * دهد، و نوع بدون handler باید **دیده شود** (fail) نه اینکه بی‌صدا رد شود.
 */
class OutboxHandlerRegistry
{
    public function for(string $eventType): ?OutboxHandler
    {
        /*
         * ⚠️ نگاشت با **دسترسی آرایه‌ای** خوانده می‌شود، نه dot-notation:
         * کلیدهایی مثل `search.index` نقطه دارند و `config('outbox.handlers.search.index')`
         * آن‌ها را به‌عنوان تودرتویی می‌خواند ⇒ همیشه null.
         */
        $handlers = (array) config('outbox.handlers', []);
        $class = $handlers[$eventType] ?? null;

        if (! is_string($class) || $class === '') {
            return null;
        }

        $handler = app($class);

        return $handler instanceof OutboxHandler ? $handler : null;
    }

    /** @return list<string> */
    public function registeredTypes(): array
    {
        return array_keys((array) config('outbox.handlers', []));
    }
}
