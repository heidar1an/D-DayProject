<?php

namespace App\Events\QuestionBank;

use Illuminate\Foundation\Events\Dispatchable;

/** گزارش سؤال ثبت شد. متن گزارش در payload نمی‌آید (ممکن است PII داشته باشد). */
final class QuestionReported
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $questionId,
        public readonly string $reportId,
        public readonly string $kind,
    ) {}
}
