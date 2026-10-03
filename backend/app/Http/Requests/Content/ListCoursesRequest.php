<?php

namespace App\Http\Requests\Content;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * فهرست دوره‌های منتشرشده. فیلترها allowlist هستند.
 *
 * `status` عمداً یک فیلتر نیست: لایهٔ دانشجو فقط published می‌بیند و اجازهٔ
 * درخواست draft ندارد. `perPage` سقف config دارد.
 */
class ListCoursesRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['subject', 'page', 'perPage'];

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
            'subject' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('content.pagination.max_per_page')],
        ];
    }
}
