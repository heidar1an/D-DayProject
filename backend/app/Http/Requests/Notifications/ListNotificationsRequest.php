<?php

namespace App\Http\Requests\Notifications;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست اعلان‌های کاربر — فاز ۱۹ (§24).
 *
 * صفحه‌بندی اجباری است (بدون آن، همهٔ اعلان‌های کاربر یک‌جا برمی‌گردد).
 * `type` allowlist است؛ نوع ناشناخته ۴۲۲ می‌گیرد.
 */
final class ListNotificationsRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['type', 'page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'type' => ['nullable', 'string', Rule::in(array_keys((array) config('notifications.types', [])))],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('notifications.pagination.max_per_page')],
        ];
    }
}
