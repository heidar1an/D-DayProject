<?php

namespace App\Http\Requests\Commerce;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/** صفحه‌بندی لیست‌های `/me/*` دامنهٔ Commerce. allowlist سخت. */
class ListCommerceRequest extends ApiFormRequest
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
            'perPage' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
