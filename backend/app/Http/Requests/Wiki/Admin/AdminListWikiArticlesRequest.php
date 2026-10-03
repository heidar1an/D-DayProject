<?php

namespace App\Http\Requests\Wiki\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست مقاله‌ها در پنل — **شامل** draft و archived.
 *
 * این تنها جایی است که `status` یک فیلتر مجاز است؛ مسیر عمومی چنین فیلتری
 * ندارد.
 */
class AdminListWikiArticlesRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['q', 'status', 'categoryId', 'subject', 'type', 'difficulty', 'page', 'perPage'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(self::ALLOWED);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:'.(int) config('wiki.search.max_query_length')],
            'status' => ['nullable', Rule::in(config('wiki.articles.statuses'))],
            'categoryId' => ['nullable', 'uuid'],
            'subject' => ['nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'type' => ['nullable', Rule::in(config('wiki.articles.content_types'))],
            'difficulty' => ['nullable', Rule::in(config('wiki.articles.difficulties'))],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('wiki.pagination.max_per_page')],
        ];
    }
}
