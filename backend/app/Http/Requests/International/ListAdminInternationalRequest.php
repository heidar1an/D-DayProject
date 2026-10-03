<?php

namespace App\Http\Requests\International;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * فهرست پنل (ناشر/دوره). `status` اینجا مجاز است چون مصرف‌کننده ادمین با مجوز
 * `intl.read` است.
 */
class ListAdminInternationalRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['status', 'providerId', 'page', 'perPage'];

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
            'status' => ['nullable', 'string', 'in:draft,published,archived'],
            'providerId' => ['nullable', 'string', 'uuid'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('international.pagination.max_per_page')],
        ];
    }
}
