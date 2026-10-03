<?php

namespace App\Http\Requests\Analytics;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * پارامترهای تحلیل.
 *
 * **`userId` عمداً هیچ قاعده‌ای ندارد** — نه در `rules` است، نه به `validated()`
 * راه می‌یابد. مالکیت تحلیل فقط از سشن می‌آید؛ هیچ مسیری برای خواندن تحلیل کاربر
 * دیگر از سمت دانشجو وجود ندارد.
 *
 * `tz` با فهرست رسمی `timezone_identifiers_list()` اعتبارسنجی می‌شود تا مقدار
 * دلخواه نتواند محاسبهٔ بازهٔ زمانی را خراب کند. در نبود آن،
 * `config('app.timezone')` استفاده می‌شود — هیچ timezone ای hardcode نیست.
 */
class AnalyticsQueryRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['bucket', 'tz', 'from', 'to']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'bucket' => ['nullable', 'string', Rule::in(config('analytics.buckets'))],
            'tz' => ['nullable', 'string', Rule::in(timezone_identifiers_list())],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ];
    }
}
