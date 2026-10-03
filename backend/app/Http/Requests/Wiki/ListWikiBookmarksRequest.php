<?php

namespace App\Http\Requests\Wiki;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * فهرست نشان‌گذاری‌های کاربر جاری.
 *
 * هیچ `userId` پذیرفته نمی‌شود — هویت فقط از سشن (§40).
 */
class ListWikiBookmarksRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['page', 'perPage'];

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
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('wiki.pagination.max_per_page')],
        ];
    }
}
