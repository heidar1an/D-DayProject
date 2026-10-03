<?php

namespace App\Events\Wiki;

use Illuminate\Foundation\Events\Dispatchable;

/** حذف نشان‌گذاری مقاله. */
class WikiBookmarkRemoved
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $articleId,
    ) {}
}
