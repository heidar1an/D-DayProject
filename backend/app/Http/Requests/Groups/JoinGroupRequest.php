<?php

namespace App\Http\Requests\Groups;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * عضویت با کد — فاز ۱۶ (§41). کد نرمال‌سازی و در سرویس هش می‌شود.
 */
final class JoinGroupRequest extends ApiFormRequest
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
            'code' => ['required', 'string', 'max:32'],
        ];
    }
}
