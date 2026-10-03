<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ویرایش کارت.
 *
 * `deck_id`، `position` و `legacy_id` تغییرناپذیرند: جابه‌جایی کارت بین دک‌ها
 * یک عملیات محصولی جدا است و `position` با `UNIQUE(deck_id, position)` مدیریت
 * می‌شود.
 */
class UpdateFlashcardRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'front' => ['sometimes', 'string', 'max:'.(int) config('flashcards.cards.front_max')],
            'back' => ['sometimes', 'string', 'max:'.(int) config('flashcards.cards.back_max')],
            'status' => ['sometimes', Rule::in(config('flashcards.cards.statuses'))],
        ];
    }
}
