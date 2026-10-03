<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * ارسال اعلان سیستمی به یک کاربر — فاز ۲۰ (§88/§108).
 *
 * نوع فقط `system` است: پنل نباید بتواند نوع‌های دامنه‌ای (نتیجهٔ آزمون،
 * دستاورد) را جعل کند؛ آن‌ها فقط از رخداد واقعی می‌آیند.
 */
final class SendNotificationRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'userId' => ['required', 'uuid', 'exists:users,id'],
            'type' => ['required', Rule::in(['system'])],
            'title' => ['required', 'string', 'max:'.(int) config('notifications.limits.title_max')],
            'body' => ['nullable', 'string', 'max:'.(int) config('notifications.limits.body_max')],
            'action' => ['nullable', 'string', 'max:'.(int) config('notifications.limits.action_max')],
        ];
    }
}
