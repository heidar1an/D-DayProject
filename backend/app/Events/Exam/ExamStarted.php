<?php

namespace App\Events\Exam;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * Domain Event: Attempt آزمون ساخته شد — فاز ۷.
 *
 * فقط شناسه و metadata حداقلی حمل می‌کند؛ نه محتوای سؤال، نه کلید، نه PII.
 * مصرف‌کنندهٔ اصلی `RecordAnalyticsEvent` است (فاز ۸) و بعد از commit صدا زده
 * می‌شود تا شکست analytics تراکنش آزمون را برنگرداند.
 */
class ExamStarted
{
    use Dispatchable;

    public function __construct(
        public readonly string $examId,
        public readonly string $attemptId,
        public readonly string $userId,
        public readonly string $kind,
    ) {}
}
