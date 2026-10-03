<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;

/**
 * اکشن‌های سطح وضعیت: suspend / bury / bookmark.
 *
 * این‌ها **وضعیت یادگیری را بازنویسی نمی‌کنند**؛ فقط پرچم‌های کنترلی را عوض
 * می‌کنند. `due_at`، `ease` و `interval` همچنان فقط از الگوریتم می‌آیند.
 */
class CardStateActionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'suspended' => ['sometimes', 'boolean'],
            'bookmarked' => ['sometimes', 'boolean'],
            'days' => ['sometimes', 'integer', 'min:1', 'max:'.(int) config('flashcards.review.max_bury_days')],
        ];
    }
}
