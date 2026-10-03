<?php

namespace App\Events\Exam;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * Domain Event: Attempt آزمون تصحیح و بسته شد — فاز ۷.
 *
 * این رویداد **بعد از commit** منتشر می‌شود. دلیل: Analytics نباید نتیجه‌ای را
 * بخواند که هنوز نهایی نشده؛ و شکست یک listener نباید تراکنش تصحیح را برگرداند.
 *
 * `attemptId` کلید dedup طبیعی است: `exam.finished:{attemptId}` ⇒ انتشار دوباره
 * رکورد تکراری نمی‌سازد.
 */
class ExamFinished
{
    use Dispatchable;

    public function __construct(
        public readonly string $examId,
        public readonly string $attemptId,
        public readonly ?string $userId,
        public readonly string $status,
        public readonly string $submitReason,
        public readonly string $resultId,
    ) {}
}
