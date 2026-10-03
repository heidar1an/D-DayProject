<?php

namespace App\Http\Requests\Flashcards\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست دک‌ها در پنل — همهٔ دک‌ها (رسمی و شخصی) قابل مشاهده‌اند.
 */
class AdminListDecksRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['owner', 'status', 'q', 'page', 'perPage'];

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
            'owner' => ['nullable', Rule::in(['official', 'personal'])],
            'status' => ['nullable', Rule::in(config('flashcards.decks.statuses'))],
            'q' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('flashcards.pagination.max_per_page')],
        ];
    }
}
