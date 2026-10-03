<?php

namespace App\Http\Requests\Flashcards\Admin;

use App\Http\Requests\ApiFormRequest;

/**
 * ویرایش دک رسمی.
 *
 * `status`/`published_at` از این مسیر عبور نمی‌کنند: انتشار و آرشیو مسیر
 * اختصاصی با مجوز `flashcards.publish` دارند.
 */
class AdminUpdateDeckRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:'.(int) config('flashcards.decks.title_max')],
            'description' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('flashcards.decks.description_max')],
            'version' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
