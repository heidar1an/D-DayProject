<?php

namespace App\Http\Requests\QuestionBank;

use App\Http\Requests\ApiFormRequest;
use App\Models\QuestionReport;
use Illuminate\Validation\Rule;

/**
 * گزارش سؤال. دسته‌ها همان پنج مقدار قابل‌اثبات در UI فعلی هستند.
 *
 * `status` و `resolved_at` هیچ قاعده‌ای ندارند: گزارش‌دهنده وضعیت بررسی را تعیین
 * نمی‌کند (و در `$fillable` مدل هم نیست).
 */
class CreateQuestionReportRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'kind' => ['required', 'string', Rule::in(QuestionReport::KINDS)],
            'body' => ['nullable', 'string', 'max:'.(int) config('question_bank.limits.report_body_max')],
        ];
    }
}
