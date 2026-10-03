<?php

namespace App\Http\Requests\International;

use App\Http\Requests\ApiFormRequest;

/**
 * ساخت/ویرایش دورهٔ بین‌الملل — فاز ۱۷.
 *
 * `required_capability` تنها کلید پرمیوم است. مقدار آن **باید** یک قابلیت واقعی
 * باشد که حداقل یک محصول آن را می‌فروشد؛ وگرنه دوره‌ای ساخته می‌شود که هیچ‌کس
 * هرگز نمی‌تواند بازش کند (قفل بی‌کلید). اعتبارسنجی `exists` روی
 * `product_capabilities.code` همین را تضمین می‌کند.
 *
 * ⚠️ هیچ فیلد `progress` یا `status` اینجا نیست: پیشرفت per-user مالکیت دامنهٔ
 * Learning است و وضعیت کار سرویس.
 */
class UpsertInternationalCourseRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'slug' => [$required, 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'provider_id' => [$required, 'string', 'uuid'],
            'title' => [$required, 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:600'],
            'category' => ['nullable', 'string', 'in:'.implode(',', (array) config('international.categories'))],
            'level' => ['nullable', 'string', 'max:40'],
            'tags' => ['nullable', 'array', 'max:8'],
            'tags.*' => ['string', 'max:40'],
            'cover_media_id' => ['nullable', 'string', 'uuid', 'exists:media,id'],
            'accent' => ['nullable', 'string', 'max:9'],
            'accent_soft' => ['nullable', 'string', 'max:9'],
            'badge' => ['nullable', 'string', 'max:40'],
            'duration_minutes' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'total_duration_label' => ['nullable', 'string', 'max:20'],
            'required_capability' => ['nullable', 'string', 'max:64', 'exists:product_capabilities,code'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
        ];
    }
}
