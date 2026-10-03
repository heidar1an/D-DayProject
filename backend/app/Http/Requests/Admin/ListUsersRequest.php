<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست کاربران در پنل — فاز ۲۰ (§91/§92).
 *
 * فیلترها و sort هر دو allowlist‌اند؛ هیچ نام ستونی از کلاینت نمی‌آید.
 */
final class ListUsersRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['q', 'phone', 'email', 'verified', 'createdFrom', 'createdTo', 'sort', 'page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'string', 'max:190'],
            'verified' => ['nullable', 'boolean'],
            'createdFrom' => ['nullable', 'date'],
            'createdTo' => ['nullable', 'date', 'after_or_equal:createdFrom'],
            'sort' => ['nullable', Rule::in(['createdAt', 'createdAtAsc'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('admin.pagination.users_max_per_page', 100)],
        ];
    }
}
