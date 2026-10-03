<?php

namespace App\Events\Learning;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * رویداد دامنه — فقط شناسه و metadata حداقلی.
 *
 * چرا payload کامل نمی‌آید: رویداد بعداً به صف/تحلیل/گیمیفیکیشن می‌رود و نباید
 * محتوای محرمانه (متن درس، پاسخ، توکن) را حمل کند. مصرف‌کننده خودش با شناسه
 * داده را می‌خواند.
 */
final class ProgressUpdated
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $lessonPageId,
        public readonly string $status,
        public readonly int $version,
    ) {}
}
