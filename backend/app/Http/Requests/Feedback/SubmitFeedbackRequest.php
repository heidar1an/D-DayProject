<?php

namespace App\Http\Requests\Feedback;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * ارسال بازخورد — فاز ۱۶ (§46-§48).
 *
 * `user` کلاینت هرگز پذیرفته نمی‌شود: هویت فقط از سشن؛ مهمان `guestRef` شفاف
 * خودش را می‌فرستد. `source` از allowlist قرارداد فرانت می‌آید (§47).
 */
final class SubmitFeedbackRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'source' => ['required', Rule::in((array) config('feedback.sources'))],
            'subject' => ['nullable', 'string', 'max:'.(int) config('feedback.subject_max')],
            'category' => ['nullable', 'string', 'max:'.(int) config('feedback.category_max')],
            'message' => ['required', 'string', 'min:3', 'max:'.(int) config('feedback.body_max')],
            'meta' => ['nullable', 'array', 'max:'.(int) config('feedback.meta_keys_max')],
            'guestRef' => ['nullable', 'string', 'max:'.(int) config('feedback.guest_ref_max'), 'regex:/^[A-Za-z0-9_-]+$/'],
        ];
    }
}
