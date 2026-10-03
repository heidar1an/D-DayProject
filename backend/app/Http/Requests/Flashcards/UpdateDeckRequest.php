<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ویرایش دک شخصی.
 *
 * `version` اختیاری است؛ اگر فرستاده شود و کهنه باشد ⇒ ۴۰۹. `owner_user_id` و
 * `author_admin_id` هرگز از اینجا عبور نمی‌کنند.
 */
class UpdateDeckRequest extends ApiFormRequest
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
            'visibility' => ['sometimes', Rule::in(config('flashcards.decks.visibilities'))],
            'status' => ['sometimes', Rule::in(config('flashcards.decks.statuses'))],
            'version' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
