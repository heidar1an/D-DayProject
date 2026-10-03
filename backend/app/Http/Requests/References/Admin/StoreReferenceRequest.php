<?php

namespace App\Http\Requests\References\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * ساخت/ویرایش مرجع — فاز ۱۵. `status`/`author` هرگز از بدنه نمی‌آیند.
 * ساختار داخلی `sections` در سرویس validate و پاک‌سازی می‌شود.
 */
final class StoreReferenceRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'slug' => ['required', 'string', 'max:'.(int) config('references.slug_max'), 'regex:/^[a-z0-9-]+$/', Rule::unique('references', 'slug')],
            'title' => ['required', 'string', 'max:'.(int) config('references.title_max')],
            'description' => ['nullable', 'string', 'max:'.(int) config('references.description_max')],
            'sections' => ['nullable', 'array'],
        ];
    }
}
