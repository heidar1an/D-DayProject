<?php

namespace App\Http\Requests\QuestionBank;

use App\Exceptions\ApiErrorException;
use App\Http\Requests\ApiFormRequest;
use App\Models\Question;
use App\Services\QuestionBank\QuestionQueryService;
use Illuminate\Validation\Rule;

/**
 * ساخت Bank Session.
 *
 * `filters` همان allowlist فهرست سؤال است. **`questionIds` پذیرفته نمی‌شود**:
 * انتخاب سؤال کار سرور است، نه کلاینت. اگر روزی use-case معتبری برای «آزمون از
 * این سؤال‌های خاص» پیدا شد، مسیر جداگانه و با مجوز جدا خواهد داشت.
 *
 * `mode` = `practice` (بازخورد فوری) | `exam` (بدون بازخورد تا پایان) — همان دو
 * حالتی که UI فعلی دارد.
 */
class StartBankSessionRequest extends ApiFormRequest
{
    /** @var list<string> */
    private const FILTER_KEYS = QuestionQueryService::FILTERS;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $filters = $this->input('filters');

        if ($filters === null) {
            return;
        }

        if (! is_array($filters)) {
            throw new ApiErrorException('VALIDATION_FAILED', 422, 'The given data was invalid.', [
                'filters' => ['FILTERS_MUST_BE_OBJECT'],
            ]);
        }

        $unknown = array_values(array_diff(array_keys($filters), self::FILTER_KEYS));

        if ($unknown !== []) {
            sort($unknown);

            throw new ApiErrorException(
                'UNKNOWN_QUERY_PARAMETER',
                400,
                'Unknown filter(s): '.implode(', ', $unknown).'.',
                ['filters' => $unknown],
            );
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'filters' => ['nullable', 'array'],
            'filters.subject' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'filters.topic' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9-]+$/'],
            'filters.chapter' => ['nullable', 'uuid'],
            'filters.lesson' => ['nullable', 'uuid'],
            'filters.difficulty' => ['nullable', Rule::in(Question::DIFFICULTIES)],
            'filters.type' => ['nullable', Rule::in(Question::TYPES)],
            'filters.source' => ['nullable', Rule::in(Question::SOURCES)],
            'filters.track' => ['nullable', Rule::in(Question::TRACKS)],
            'filters.year' => ['nullable', 'integer', 'min:1300', 'max:1500'],
            'filters.q' => ['nullable', 'string', 'max:120'],
            'count' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('question_bank.bank_session.max_count')],
            'mode' => ['nullable', Rule::in(config('question_bank.bank_session.modes'))],
        ];
    }
}
