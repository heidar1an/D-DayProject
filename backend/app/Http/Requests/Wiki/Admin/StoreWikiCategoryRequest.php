<?php

namespace App\Http\Requests\Wiki\Admin;

use App\Http\Requests\ApiFormRequest;

/**
 * ساخت دستهٔ ویکی.
 *
 * `status` از بدنه خوانده نمی‌شود؛ دسته تازه همیشه `draft` است و انتشار مسیر
 * جدا دارد. `parentId` با حفاظت چرخه در سرویس بررسی می‌شود.
 */
class StoreWikiCategoryRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'slug' => ['required', 'string', 'max:'.(int) config('wiki.categories.slug_max')],
            'name' => ['required', 'string', 'max:'.(int) config('wiki.categories.name_max')],
            'description' => ['nullable', 'string', 'max:'.(int) config('wiki.categories.description_max')],
            'parentId' => ['nullable', 'uuid'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ];
    }
}
