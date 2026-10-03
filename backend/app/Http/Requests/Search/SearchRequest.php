<?php

namespace App\Http\Requests\Search;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * کوئری جست‌وجو — فاز ۱۹ (§37).
 *
 * `type` و `sort` هر دو allowlist‌اند؛ هیچ ستون/عملگر دلخواهی از کلاینت نمی‌آید.
 * `q` سقف طول دارد تا پرس‌وجوی بی‌کران ممکن نباشد (§42).
 */
final class SearchRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['q', 'type', 'sort', 'page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => [
                'required',
                'string',
                'min:'.(int) config('search.query.min_length'),
                'max:'.(int) config('search.query.max_length'),
            ],
            'type' => ['nullable', 'string', Rule::in(array_keys((array) config('search.domains', [])))],
            'sort' => ['nullable', 'string', Rule::in((array) config('search.sorts', ['relevance']))],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('search.pagination.max_per_page')],
        ];
    }
}
