<?php

namespace App\Http\Requests\Exam;

use App\Http\Requests\ApiFormRequest;

/**
 * پایان Attempt — **بدنهٔ خالی**.
 *
 * فهرست فیلدهای ممنوع که هیچ قاعده‌ای ندارند و به `validated()` راه نمی‌یابند:
 * `score`, `correct`, `wrong`, `blank`, `negativeMarking`, `questionIds`,
 * `gradingRules`, `duration`, `deadline`, `status`, `result`, `userId`.
 *
 * `reason` هم پذیرفته نمی‌شود: دلیل پایان از **ساعت سرور** مشتق می‌شود
 * (`user` اگر پیش از مهلت، `grace` اگر در پنجرهٔ گریس، `timeout` اگر گذشته).
 * کلاینت نمی‌تواند بگوید «زمانم تمام شد».
 *
 * کلید idempotency از هدر می‌آید.
 */
class FinishExamAttemptRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
