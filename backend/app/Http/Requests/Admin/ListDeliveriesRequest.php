<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست تحویل‌های اعلان — فاز ۲۰ (§88).
 */
final class ListDeliveriesRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['channel', 'status', 'type', 'notificationId', 'page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'channel' => ['nullable', Rule::in(array_keys((array) config('notifications.channels', [])))],
            'status' => ['nullable', Rule::in(['pending', 'sent', 'delivered', 'failed', 'skipped'])],
            'type' => ['nullable', Rule::in(array_keys((array) config('notifications.types', [])))],
            'notificationId' => ['nullable', 'uuid'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('notifications.pagination.max_per_page')],
        ];
    }
}
