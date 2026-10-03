<?php

namespace App\Events\Learning;

use Illuminate\Foundation\Events\Dispatchable;

/** گذار به `completed`. فقط شناسه‌ها — هیچ محتوایی. */
final class LessonCompleted
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $lessonPageId,
        public readonly string $lessonId,
    ) {}
}
