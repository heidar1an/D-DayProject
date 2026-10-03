<?php

namespace App\Http\Requests\Exam;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست آزمون‌ها.
 *
 * allowlist صریح است و پارامتر ناشناخته ۴۰۰ می‌گیرد — تا کسی با
 * `?status=draft` یا `?include=answer_key` امیدوار به «پیاده شدن بعدی» نشود.
 * `draft` در ورودی پذیرفته می‌شود ولی در سرویس هم فیلتر می‌شود؛ عملاً هیچ‌وقت
 * آزمون draft را برنمی‌گرداند چون `scopePubliclyVisible` همیشه اعمال است.
 */
class ListExamsRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['kind', 'subject_id', 'status', 'page', 'per_page']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'kind' => ['nullable', 'string', Rule::in(config('exam.kinds'))],
            'subject_id' => ['nullable', 'uuid'],
            'status' => ['nullable', 'string', Rule::in(config('exam.statuses'))],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('exam.pagination.max_per_page')],
        ];
    }
}
