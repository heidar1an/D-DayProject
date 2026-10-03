<?php

namespace App\Events\Wiki;

use Illuminate\Foundation\Events\Dispatchable;

/** نشان‌گذاری مقاله — فقط شناسه، بدون محتوا. */
class WikiBookmarkAdded
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $articleId,
    ) {}
}
