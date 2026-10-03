<?php

namespace App\Events\Learning;

use Illuminate\Foundation\Events\Dispatchable;

/** ثبت یک نشست مطالعه. `durationSeconds` می‌تواند null باشد (نشست باز). */
final class StudySessionRecorded
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $studySessionId,
        public readonly string $source,
        public readonly ?int $durationSeconds,
    ) {}
}
