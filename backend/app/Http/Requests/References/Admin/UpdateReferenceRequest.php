<?php

namespace App\Http\Requests\References\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * ویرایش مرجع — فاز ۱۵. `expectedVersion` برای optimistic lock (۴۰۹).
 */
final class UpdateReferenceRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $referenceId = (string) $this->route('reference');

        return [
            'slug' => ['sometimes', 'string', 'max:'.(int) config('references.slug_max'), 'regex:/^[a-z0-9-]+$/', Rule::unique('references', 'slug')->ignore($referenceId)],
            'title' => ['sometimes', 'string', 'max:'.(int) config('references.title_max')],
            'description' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('references.description_max')],
            'sections' => ['sometimes', 'nullable', 'array'],
            'expectedVersion' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
