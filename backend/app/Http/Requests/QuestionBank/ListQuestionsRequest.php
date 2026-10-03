<?php

namespace App\Http\Requests\QuestionBank;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use App\Models\Question;
use App\Services\QuestionBank\QuestionQueryService;
use Illuminate\Validation\Rule;

/**
 * فهرست سؤال‌ها.
 *
 * `status` عمداً یک فیلتر **نیست**: لایهٔ دانشجو فقط published می‌بیند. ارسال
 * `?status=draft` با ۴۰۰ رد می‌شود، نه اینکه بی‌صدا نادیده گرفته شود.
 */
class ListQuestionsRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = [
        'subject', 'topic', 'chapter', 'lesson', 'difficulty', 'type',
        'source', 'track', 'year', 'q', 'sort', 'page', 'perPage',
    ];

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
            'subject' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'topic' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9-]+$/'],
            'chapter' => ['nullable', 'uuid'],
            'lesson' => ['nullable', 'uuid'],
            'difficulty' => ['nullable', Rule::in(Question::DIFFICULTIES)],
            'type' => ['nullable', Rule::in(Question::TYPES)],
            'source' => ['nullable', Rule::in(Question::SOURCES)],
            'track' => ['nullable', Rule::in(Question::TRACKS)],
            'year' => ['nullable', 'integer', 'min:1300', 'max:1500'],
            'q' => ['nullable', 'string', 'max:120'],
            'sort' => ['nullable', Rule::in(QuestionQueryService::SORTS)],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('question_bank.pagination.max_per_page')],
        ];
    }
}
