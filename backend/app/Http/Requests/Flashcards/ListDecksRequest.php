<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست دک‌های قابل‌دسترس کاربر.
 *
 * `owner` فقط دو مقدار دارد (`me` | `official`) و **فیلتر مالکیت است، نه مجوز**:
 * حتی `owner=me` هم از `FlashcardAccess` عبور می‌کند. هیچ `userId` پذیرفته
 * نمی‌شود.
 */
class ListDecksRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['owner', 'q', 'page', 'perPage'];

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
            'owner' => ['nullable', Rule::in(['me', 'official'])],
            'q' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('flashcards.pagination.max_per_page')],
        ];
    }
}
