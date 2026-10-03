<?php

namespace App\Http\Requests\International;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * فهرست عمومی دوره‌های بین‌الملل. فیلترها allowlist هستند.
 *
 * `status` عمداً فیلتر نیست: لایهٔ دانشجو فقط `published` می‌بیند و اجازهٔ
 * درخواست پیش‌نویس ندارد (Prompt §10). `perPage` سقف config دارد.
 */
class ListInternationalCoursesRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['provider', 'category', 'search', 'page', 'perPage'];

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
            'provider' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'category' => ['nullable', 'string', 'in:'.implode(',', (array) config('international.categories'))],
            'search' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('international.pagination.max_per_page')],
        ];
    }
}
