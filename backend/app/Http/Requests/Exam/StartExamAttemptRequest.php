<?php

namespace App\Http\Requests\Exam;

use App\Http\Requests\ApiFormRequest;

/**
 * شروع Attempt — **بدنهٔ خالی**.
 *
 * هیچ فیلدی پذیرفته نمی‌شود: نه `duration`، نه `questionIds`، نه `userId`.
 * همهٔ ورودی‌های لازم (آزمون، هویت، مهلت، فهرست سؤال) سمت سرور تعیین می‌شوند.
 * کلید idempotency از **هدر** می‌آید، نه بدنه.
 *
 * وجود این کلاس با `rules()` خالی عمدی است: اگر روزی کسی `duration` را «برای
 * راحتی» به rules اضافه کند، تست `ExamScoreManipulationTest` می‌شکند.
 */
class StartExamAttemptRequest extends ApiFormRequest
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
