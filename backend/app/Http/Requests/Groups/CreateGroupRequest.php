<?php

namespace App\Http\Requests\Groups;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * ساخت گروه — فاز ۱۶ (§40).
 *
 * `ownerUserId`/`codeHash` در قرارداد نیستند: میزبان از سشن و کد سمت سرور
 * ساخته و hash می‌شود (§40).
 */
final class CreateGroupRequest extends ApiFormRequest
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
            'seats' => ['required', 'integer', 'min:'.(int) config('groups.seats.min'), 'max:'.(int) config('groups.seats.max')],
        ];
    }
}
