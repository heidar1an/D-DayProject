<?php

namespace App\Http\Requests\Wiki\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ویرایش/جابه‌جایی دسته.
 *
 * `parentId` تغییرناپذیر نیست (جابه‌جایی در درخت یک عملیات واقعی پنل است)، ولی
 * عبور از این مسیر به معنای عبور از **حفاظت چرخه** است: سرویس زنجیرهٔ والدها را
 * پیمایش می‌کند و A→B→C→A را رد می‌کند (§38).
 */
class UpdateWikiCategoryRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'slug' => ['sometimes', 'string', 'max:'.(int) config('wiki.categories.slug_max')],
            'name' => ['sometimes', 'string', 'max:'.(int) config('wiki.categories.name_max')],
            'description' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('wiki.categories.description_max')],
            'parentId' => ['sometimes', 'nullable', 'uuid'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'status' => ['sometimes', Rule::in(config('wiki.categories.statuses'))],
        ];
    }
}
