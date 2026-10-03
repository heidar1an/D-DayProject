<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست Audit log — فاز ۲۰ (§82).
 *
 * فقط خواندن؛ هیچ مسیری audit را ویرایش/حذف نمی‌کند.
 */
final class ListAuditLogsRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['action', 'actorType', 'actorId', 'targetType', 'targetId', 'from', 'to', 'page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'action' => ['nullable', 'string', 'max:120'],
            'actorType' => ['nullable', Rule::in(['admin', 'user', 'system'])],
            'actorId' => ['nullable', 'string', 'max:64'],
            'targetType' => ['nullable', 'string', 'max:64'],
            'targetId' => ['nullable', 'string', 'max:64'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('audit.pagination.max_per_page')],
        ];
    }
}
