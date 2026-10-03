<?php

namespace App\Http\Requests\Learning;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ثبت نشست مطالعه.
 *
 * `userId` عمداً هیچ قاعده‌ای ندارد: نه در `rules` است، نه در `validated()`
 * برمی‌گردد. مالکیت فقط از سشن می‌آید.
 *
 * `durationSec` اختیاری است: سرور خودش از `startedAt`/`endedAt` مشتق می‌کند و
 * اگر کلاینت عددی بفرستد با اختلاف واقعی مقایسه می‌شود.
 */
class CreateStudySessionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'startedAt' => ['required', 'date'],
            'endedAt' => ['nullable', 'date'],
            'durationSec' => ['nullable', 'integer', 'min:0', 'max:'.(int) config('learning.study_sessions.max_duration_seconds')],
            'source' => ['required', 'string', Rule::in(config('learning.study_sessions.sources'))],
            'lessonPageId' => ['nullable', 'uuid'],
        ];
    }
}
