<?php

namespace App\Http\Requests\GreenPath;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Support\Carbon;

/**
 * بازهٔ تقویم مسیر سبز — فقط بازهٔ بستهٔ محدود؛ هیچ کوئری بی‌کرانی.
 *
 * `from`/`to` هر دو شکل `Y-m-d` دارند و «امروز» هرگز از کلاینت نمی‌آید — این
 * دو فقط بازهٔ نمایش را انتخاب می‌کنند، نه جعل تاریخ.
 */
class CalendarRangeRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /* اگر قواعد شکل (date_format) شکسته‌اند، parse نکن — خطا گرفته شده. */
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $from = $this->filled('from') ? Carbon::parse((string) $this->input('from')) : null;
            $to = $this->filled('to') ? Carbon::parse((string) $this->input('to')) : null;

            if ($from !== null && $to !== null && $to->lt($from)) {
                $validator->errors()->add('to', 'RANGE_ORDER');
            }

            $maxDays = max(1, (int) config('green_path.planning.calendar_max_days'));

            /* diffInDays در Carbon 3 علامت‌دار است — قدرمطلق بگیر. */
            if ($from !== null && $to !== null && abs($to->diffInDays($from)) > $maxDays) {
                $validator->errors()->add('to', 'RANGE_TOO_LARGE');
            }
        });
    }

    /** از/تا را با پیش‌فرضِ سرور کامل می‌کند — ۱۴ روز از امروز. */
    public function range(): array
    {
        $today = Carbon::now();

        return [
            $this->filled('from') ? Carbon::parse((string) $this->input('from')) : $today->copy(),
            $this->filled('to') ? Carbon::parse((string) $this->input('to')) : $today->copy()->addDays(13),
        ];
    }
}
