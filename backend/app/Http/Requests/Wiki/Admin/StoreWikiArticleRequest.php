<?php

namespace App\Http\Requests\Wiki\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ساخت مقاله.
 *
 * فیلدهای ممنوع (نه در rules ⇒ نه در `validated()`): `authorAdminId`,
 * `editorAdminId`, `status`, `publishedAt`, `version`, `viewCount`,
 * `popularity`. نویسنده از سشن ادمین و وضعیت از مسیر publish/archive تعیین
 * می‌شود.
 */
class StoreWikiArticleRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'slug' => ['required', 'string', 'max:'.(int) config('wiki.articles.slug_max')],
            'title' => ['required', 'string', 'max:'.(int) config('wiki.articles.title_max')],
            'summary' => ['nullable', 'string', 'max:'.(int) config('wiki.articles.summary_max')],
            'body' => ['required', 'string', 'max:'.(int) config('wiki.articles.body_max')],
            'categoryId' => ['nullable', 'uuid'],
            'subject' => ['nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'contentType' => ['nullable', Rule::in(config('wiki.articles.content_types'))],
            'difficulty' => ['nullable', Rule::in(config('wiki.articles.difficulties'))],
            'keyFacts' => ['nullable', 'array', 'max:'.(int) config('wiki.articles.max_key_facts')],
            'keyFacts.*' => ['string', 'max:1000'],
            'keywords' => ['nullable', 'array', 'max:'.(int) config('wiki.articles.max_keywords')],
            'keywords.*' => ['string', 'max:80'],
            'readMinutes' => ['nullable', 'integer', 'min:1', 'max:600'],
        ];
    }
}
