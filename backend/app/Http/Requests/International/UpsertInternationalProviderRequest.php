<?php

namespace App\Http\Requests\International;

use App\Http\Requests\ApiFormRequest;

/**
 * ساخت/ویرایش ناشر — فاز ۱۷.
 *
 * `slug` **اجباری** است و از عنوان ساخته نمی‌شود: عنوان‌ها فارسی‌اند و تولید
 * خودکار slug از متن فارسی یا رشتهٔ خالی می‌دهد یا یک شناسهٔ بی‌معنا؛ و آدرس
 * عمومی باید پایدار و قابل‌حدس‌نبودن‌اش تحت کنترل نویسنده باشد.
 *
 * `status` اینجا نیست: گذار وضعیت کار سرویس است، نه ورودی درخواست.
 */
class UpsertInternationalProviderRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /* در ویرایش، همهٔ فیلدها اختیاری‌اند (PATCH جزئی). */
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'slug' => [$required, 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'name' => [$required, 'string', 'max:160'],
            'name_en' => ['nullable', 'string', 'max:160'],
            'kind' => ['nullable', 'string', 'in:'.implode(',', (array) config('international.provider_kinds'))],
            'country' => ['nullable', 'string', 'max:80'],
            'founded' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:800'],
            'focus' => ['nullable', 'array', 'max:6'],
            'focus.*' => ['string', 'max:60'],
            'logo_media_id' => ['nullable', 'string', 'uuid', 'exists:media,id'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'marquee_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
        ];
    }
}
