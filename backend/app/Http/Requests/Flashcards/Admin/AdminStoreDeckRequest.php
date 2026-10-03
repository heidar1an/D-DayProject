<?php

namespace App\Http\Requests\Flashcards\Admin;

use App\Http\Requests\ApiFormRequest;

/**
 * ساخت دک رسمی TAPESH.
 *
 * `owner_user_id` در این مسیر همیشه `null` است و از بدنه خوانده **نمی‌شود**.
 * `author_admin_id` از سشن ادمین می‌آید.
 */
class AdminStoreDeckRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:'.(int) config('flashcards.decks.title_max')],
            'description' => ['nullable', 'string', 'max:'.(int) config('flashcards.decks.description_max')],
        ];
    }
}
