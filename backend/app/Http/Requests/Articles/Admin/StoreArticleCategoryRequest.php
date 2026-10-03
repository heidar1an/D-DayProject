<?php

namespace App\Http\Requests\Articles\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ساخت/ویرایش دستهٔ مقاله — فاز ۱۶ (§25).
 */
final class StoreArticleCategoryRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $isUpdate = $this->isMethod('PATCH');

        $rules = [
            'slug' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:'.(int) config('articles.categories.slug_max'), 'regex:/^[a-z0-9-]+$/'],
            'name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:'.(int) config('articles.categories.name_max')],
            'sortOrder' => ['sometimes', 'integer', 'min:0'],
        ];

        if ($isUpdate) {
            $categoryId = (string) $this->route('category');
            $rules['slug'] = ['sometimes', 'string', 'max:'.(int) config('articles.categories.slug_max'), 'regex:/^[a-z0-9-]+$/', Rule::unique('article_categories', 'slug')->ignore($categoryId)];
        } else {
            $rules['slug'][] = Rule::unique('article_categories', 'slug');
        }

        return $rules;
    }
}
