<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * صف مرور.
 *
 * `mode` از UI واقعی استخراج شده: `today` (پیش‌فرض) | `deck` | `weak` | `cram`.
 * `limit` سقف‌دار است؛ کلاینت می‌تواند کمتر بخواهد، بیشتر نه.
 */
class ReviewQueueRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['mode', 'deckId', 'limit'];

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
            'mode' => ['nullable', Rule::in(config('flashcards.review.modes'))],
            'deckId' => ['nullable', 'uuid'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('flashcards.review.queue_limit_max')],
        ];
    }
}
