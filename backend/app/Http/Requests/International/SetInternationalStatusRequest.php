<?php

namespace App\Http\Requests\International;

use App\Http\Requests\ApiFormRequest;

/**
 * گذار وضعیت انتشار — فاز ۱۷.
 *
 * فقط سه مقدار ممکن است (همان واژگان Content Engine). **مجاز بودن گذار** در
 * سرویس چک می‌شود، نه اینجا: قاعدهٔ گذار دامنه است و اگر روزی نقشهٔ گذار عوض
 * شود، نباید دو جا تغییر کند.
 */
class SetInternationalStatusRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:draft,published,archived'],
        ];
    }
}
