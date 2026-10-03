<?php

namespace App\Http\Requests\Wiki;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use App\Services\Wiki\WikiQueryService;
use Illuminate\Validation\Rule;

/**
 * جست‌وجوی ویکی.
 *
 * `q` اجباری است و حداقل طول دارد؛ جست‌وجوی خالی نباید کل دیتابیس را برگرداند.
 * `page`/`perPage` سقف‌دار و `sort` از allowlist.
 */
class SearchWikiRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(WikiQueryService::FILTERS);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:'.(int) config('wiki.search.min_query_length'), 'max:'.(int) config('wiki.search.max_query_length')],
            'subject' => ['nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'type' => ['nullable', Rule::in(config('wiki.articles.content_types'))],
            'difficulty' => ['nullable', Rule::in(config('wiki.articles.difficulties'))],
            'categoryId' => ['nullable', 'uuid'],
            'sort' => ['nullable', Rule::in(WikiQueryService::SORTS)],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('wiki.pagination.max_per_page')],
        ];
    }
}
