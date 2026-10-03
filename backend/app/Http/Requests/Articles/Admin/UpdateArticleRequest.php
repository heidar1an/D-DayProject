<?php

namespace App\Http\Requests\Articles\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ویرایش مقاله — فاز ۱۶. `expectedVersion` ناهم‌خوان ⇒ ۴۰۹.
 */
final class UpdateArticleRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $articleId = (string) $this->route('article');

        return [
            'categoryId' => ['sometimes', 'nullable', 'uuid', 'exists:article_categories,id'],
            'slug' => ['sometimes', 'string', 'max:'.(int) config('articles.slug_max'), 'regex:/^[a-z0-9-]+$/', Rule::unique('articles', 'slug')->ignore($articleId)],
            'title' => ['sometimes', 'string', 'max:'.(int) config('articles.title_max')],
            'summary' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('articles.summary_max')],
            'body' => ['sometimes', 'string', 'max:'.(int) config('articles.body_max')],
            'expectedVersion' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
