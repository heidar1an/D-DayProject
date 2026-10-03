<?php

namespace App\Http\Requests\References;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * لیست عمومی مراجع — فاز ۱۵. `status` فیلتر عمومی نیست (§14).
 */
final class ListReferencesRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('references.pagination.max_per_page')],
        ];
    }
}
