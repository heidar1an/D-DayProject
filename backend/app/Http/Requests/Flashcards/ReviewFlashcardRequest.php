<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ثبت مرور.
 *
 * **فقط** `rating` و `requestKey`. فهرست فیلدهای ممنوعی که در این کلاس هیچ
 * قاعده‌ای ندارند (پس به `validated()` راه نمی‌یابند و اگر فرستاده شوند
 * نادیده گرفته نمی‌شوند بلکه در `algorithmVersion`/`nextDueAt` و مانند آن
 * هرگز دیده نمی‌شوند):
 *   `intervalDays`, `interval`, `ease`, `nextDueAt`, `dueAt`,
 *   `algorithmVersion`, `userId`, `state`, `masteryScore`, `reviewedAt`.
 *
 * `rating` سمت سرور هم دوباره اعتبارسنجی می‌شود (لایهٔ دوم) و مقادیرش همان
 * چهار مقدار canonical UI است.
 */
class ReviewFlashcardRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'rating' => ['required', 'string', Rule::in(config('flashcards.ratings'))],
            'requestKey' => ['nullable', 'string', 'max:96'],
            'timeSpent' => ['nullable', 'integer', 'min:0', 'max:3600'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'rating.required' => 'A rating is required to record a review.',
        ];
    }
}
