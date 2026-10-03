<?php

namespace App\Http\Requests\Feedback\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست/وضعیت بازخورد پنل — فاز ۱۶ (§48).
 */
final class AdminFeedbackRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->isMethod('GET')) {
            $this->rejectUnknownQuery(['source', 'status', 'page', 'perPage']);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        if ($this->isMethod('GET')) {
            return [
                'source' => ['nullable', Rule::in((array) config('feedback.sources'))],
                'status' => ['nullable', Rule::in((array) config('feedback.statuses'))],
                'page' => ['nullable', 'integer', 'min:1'],
                'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('feedback.pagination.max_per_page')],
            ];
        }

        return [
            'status' => ['required', Rule::in((array) config('feedback.statuses'))],
        ];
    }
}
