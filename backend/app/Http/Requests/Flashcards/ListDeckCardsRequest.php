<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * کارت‌های یک دک مشخص.
 *
 * دک از **مسیر** می‌آید، نه query؛ پس `deckId` در query پارامتر ناشناخته است و
 * با ۴۰۰ رد می‌شود (نه اینکه بی‌صدا نادیده گرفته شود و کاربر فکر کند دک دیگری
 * دیده است).
 */
class ListDeckCardsRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['page', 'perPage'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(self::ALLOWED);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('flashcards.pagination.max_per_page')],
        ];
    }
}
