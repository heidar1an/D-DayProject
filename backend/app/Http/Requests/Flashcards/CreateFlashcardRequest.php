<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;
use App\Models\Flashcard;

/**
 * ساخت کارت — تک یا دسته‌ای.
 *
 * دو شکل پذیرفته می‌شود و **دقیقاً یکی** باید بیاید:
 *   { front, back }                       → یک کارت
 *   { cards: [{front, back}, …] }         → دسته‌ای (import)
 *
 * سقف تعداد در `config('flashcards.decks.max_cards_per_request')` است.
 */
class CreateFlashcardRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $max = (int) config('flashcards.decks.max_cards_per_request');

        return [
            'front' => ['required_without:cards', 'nullable', 'string', 'max:'.(int) config('flashcards.cards.front_max')],
            'back' => ['required_without:cards', 'nullable', 'string', 'max:'.(int) config('flashcards.cards.back_max')],
            'status' => ['prohibited'],
            'cards' => ['required_without:front', 'nullable', 'array', 'min:1', 'max:'.$max],
            'cards.*.front' => ['required', 'string', 'max:'.(int) config('flashcards.cards.front_max')],
            'cards.*.back' => ['required', 'string', 'max:'.(int) config('flashcards.cards.back_max')],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'status.prohibited' => 'Card status is assigned by the server.',
            'cards.max' => 'Too many cards in one request.',
        ];
    }

    /** آیا درخواست دسته‌ای است؟ */
    public function isBatch(): bool
    {
        return is_array($this->input('cards'));
    }

    /**
     * @return list<array{front: string, back: string}>
     */
    public function batch(): array
    {
        /** @var list<array{front: string, back: string}> $cards */
        $cards = $this->validated()['cards'];

        return $cards;
    }

    /** وضعیت کارت تازه همیشه `active` است — کلاینت آن را تعیین نمی‌کند. */
    public function defaultStatus(): string
    {
        return Flashcard::STATUS_ACTIVE;
    }
}
