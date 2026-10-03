<?php

namespace App\Services\Outbox\Handlers;

use App\Models\OutboxEvent;

/**
 * قرارداد handler رخداد Outbox — فاز ۱۹.
 *
 * پیاده‌سازی باید **idempotent** باشد: ممکن است Job پس از خطای موقت دوباره
 * اجرا شود. خطا باید پرتاب شود تا Job واقعاً retry شود و در نهایت در
 * dead-letter دیده شود؛ بلعیدن خطا یعنی «موفق» دروغین.
 */
interface OutboxHandler
{
    public function handle(OutboxEvent $event): void;
}
