<?php

namespace App\Http\Requests\GreenPath;

use App\Http\Requests\ApiFormRequest;
use App\Models\GreenPathStep;

/**
 * گذار وضعیت یک قدم مسیر سبز.
 *
 *   • `version` اجباری است (optimistic lock) — `0` یعنی «قدم را ندیده‌ام» و
 *     همیشه ۴۰۹ می‌گیرد چون قدم موجود است.
 *   • `status` فقط از مجموعهٔ بسته؛ گذارها در سرویس اعتبارسنجی می‌شوند.
 *   • `userId`، `pathId`، `dueAt`، `completedAt` و هر فیلد داخلی در `rules`
 *     نیستند ⇒ `validated()` هرگز آن‌ها را برنمی‌گرداند (ضد mass assignment).
 */
class UpdateGreenPathStepRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:'.implode(',', [
                GreenPathStep::STATUS_AVAILABLE,
                GreenPathStep::STATUS_IN_PROGRESS,
                GreenPathStep::STATUS_COMPLETED,
            ])],
            'version' => ['required', 'integer', 'min:1'],
        ];
    }
}
