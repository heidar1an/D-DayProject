<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * بازسازی ایندکس جست‌وجو — فاز ۲۰ (§89).
 *
 * `entityType` اختیاری و allowlist است؛ خالی یعنی همهٔ دامنه‌ها.
 */
final class RebuildSearchRequest extends ApiFormRequest
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
            'entityType' => ['nullable', 'string', Rule::in(array_keys((array) config('search.domains', [])))],
        ];
    }
}
