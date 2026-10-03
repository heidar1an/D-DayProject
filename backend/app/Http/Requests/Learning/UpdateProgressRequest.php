<?php

namespace App\Http\Requests\Learning;

use App\Http\Requests\ApiFormRequest;

/**
 * به‌روزرسانی پیشرفت یک صفحهٔ درس.
 *
 * نکته‌های قرارداد:
 *   • `version` **اجباری** است: `0` یعنی «هنوز رکوردی برای این صفحه ندارم».
 *     بدون آن، دو درخواست هم‌زمان می‌توانند نوشتن یکدیگر را بی‌صدا پاک کنند.
 *   • `secondsSpent` یک **دلتا** است (نه مقدار مطلق) و سقف دارد. عدد بزرگ‌تر از
 *     سقف ۴۲۲ می‌گیرد، نه clamp بی‌صدا — کلاینت خراب باید بفهمد.
 *   • `userId`، `status`، `id` و هر فیلد داخلی در `rules` نیستند، پس
 *     `validated()` هرگز آن‌ها را برنمی‌گرداند (ضد mass assignment).
 */
class UpdateProgressRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:0'],
            'lastPosition' => ['nullable', 'integer', 'min:0', 'max:'.(int) config('learning.progress.max_position')],
            'completed' => ['nullable', 'boolean'],
            'secondsSpent' => ['nullable', 'integer', 'min:0', 'max:'.(int) config('learning.progress.max_seconds_per_update')],
        ];
    }
}
