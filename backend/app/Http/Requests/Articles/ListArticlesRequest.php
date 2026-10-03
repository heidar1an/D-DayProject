<?php

namespace App\Http\Requests\Articles;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست عمومی مقاله‌ها — فاز ۱۶ (§27).
 *
 * `status` عمداً فیلتر نیست: مسیر عمومی فقط `published` می‌بیند. Sort از
 * allowlist config است، نه ستون دلخواه کلاینت.
 */
final class ListArticlesRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['category', 'categoryId', 'sort', 'page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'category' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9-]+$/'],
            'categoryId' => ['nullable', 'uuid'],
            'sort' => ['nullable', Rule::in((array) config('articles.sorts'))],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('articles.pagination.max_per_page')],
        ];
    }
}
