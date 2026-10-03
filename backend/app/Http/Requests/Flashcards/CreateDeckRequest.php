<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;

/**
 * ساخت دک شخصی.
 *
 * فیلدهای ممنوع (نه در rules ⇒ نه در `validated()`): `ownerUserId`,
 * `owner_user_id`, `status`, `visibility`, `version`, `authorAdminId`.
 * مالکیت از سشن می‌آید و دک تازه همیشه `draft` + `private` است.
 */
class CreateDeckRequest extends ApiFormRequest
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
