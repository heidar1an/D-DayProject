<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * ارسال گروهی اعلان — فاز ۲۰ (§103/§105).
 *
 * `broadcastKey` کلید idempotency است: ارسال دوبارهٔ همان کلید اعلان تکراری
 * نمی‌سازد (§27). عملیات صف‌شده و chunked است، پس درخواست HTTP طولانی نمی‌شود.
 */
final class BroadcastNotificationRequest extends ApiFormRequest
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
            'broadcastKey' => ['required', 'string', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
            'title' => ['required', 'string', 'max:'.(int) config('notifications.limits.title_max')],
            'body' => ['nullable', 'string', 'max:'.(int) config('notifications.limits.body_max')],
        ];
    }
}
