<?php

namespace App\Http\Requests\Wiki\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ویرایش مقاله — با optimistic lock اجباری.
 *
 * `version` **اجباری** است (برخلاف دک فلش‌کارت که اختیاری است): ویرایش هم‌زمان
 * دو ادمین روی یک مقالهٔ پزشکی باید صریح شکست بخورد، نه اینکه یکی بی‌صدا
 * دیگری را بازنویسی کند (§35).
 */
class UpdateWikiArticleRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:1'],
            'slug' => ['sometimes', 'string', 'max:'.(int) config('wiki.articles.slug_max')],
            'title' => ['sometimes', 'string', 'max:'.(int) config('wiki.articles.title_max')],
            'summary' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('wiki.articles.summary_max')],
            'body' => ['sometimes', 'string', 'max:'.(int) config('wiki.articles.body_max')],
            'categoryId' => ['sometimes', 'nullable', 'uuid'],
            'subject' => ['sometimes', 'nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'contentType' => ['sometimes', 'nullable', Rule::in(config('wiki.articles.content_types'))],
            'difficulty' => ['sometimes', 'nullable', Rule::in(config('wiki.articles.difficulties'))],
            'keyFacts' => ['sometimes', 'nullable', 'array', 'max:'.(int) config('wiki.articles.max_key_facts')],
            'keyFacts.*' => ['string', 'max:1000'],
            'keywords' => ['sometimes', 'nullable', 'array', 'max:'.(int) config('wiki.articles.max_keywords')],
            'keywords.*' => ['string', 'max:80'],
            'readMinutes' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:600'],
        ];
    }
}
