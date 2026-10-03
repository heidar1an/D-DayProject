<?php

namespace App\Http\Requests\Articles\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ساخت مقاله — فاز ۱۶. `status`/`author_admin_id` اینجا وجود ندارند: مسیر
 * publish جدا است و نویسنده از سشن ادمین می‌آید (§29 Mass Assignment).
 */
final class StoreArticleRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'categoryId' => ['nullable', 'uuid', 'exists:article_categories,id'],
            'slug' => ['required', 'string', 'max:'.(int) config('articles.slug_max'), 'regex:/^[a-z0-9-]+$/', 'unique:articles,slug'],
            'title' => ['required', 'string', 'max:'.(int) config('articles.title_max')],
            'summary' => ['nullable', 'string', 'max:'.(int) config('articles.summary_max')],
            'body' => ['required', 'string', 'max:'.(int) config('articles.body_max')],
        ];
    }
}
