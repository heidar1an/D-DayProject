<?php

namespace App\Http\Requests\University;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * فهرست دانشگاه‌ها — فقط پارامترهای allowlist شده پذیرفته می‌شوند.
 * هیچ پارامتری به‌صورت رشتهٔ SQL به کوئری نمی‌رود.
 */
class IndexUniversitiesRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:80'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('identity.universities.max_per_page')],
            'sort' => ['nullable', Rule::in(['name', '-name', 'slug', '-slug'])],
            // هر پارامتر دیگری (مثل `q` یا `filter`) رد می‌شود تا allowlist واقعی باشد.
            'q' => ['prohibited'],
            'filter' => ['prohibited'],
            'order' => ['prohibited'],
        ];
    }
}
