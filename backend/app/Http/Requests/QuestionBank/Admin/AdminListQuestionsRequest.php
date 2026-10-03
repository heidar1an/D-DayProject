<?php

namespace App\Http\Requests\QuestionBank\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use App\Models\Question;
use Illuminate\Validation\Rule;

/**
 * فهرست سؤال‌ها در پنل — اینجا `status` **مجاز** است (برخلاف مسیر دانشجو).
 * مجوز `testbank.read` در middleware چک می‌شود، نه اینجا.
 */
class AdminListQuestionsRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['status', 'subject', 'topic', 'difficulty', 'source', 'track', 'q', 'page', 'perPage'];

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
            'status' => ['nullable', Rule::in([Question::STATUS_DRAFT, Question::STATUS_PUBLISHED, Question::STATUS_ARCHIVED])],
            'subject' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'topic' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9-]+$/'],
            'difficulty' => ['nullable', Rule::in(Question::DIFFICULTIES)],
            'source' => ['nullable', Rule::in(Question::SOURCES)],
            'track' => ['nullable', Rule::in(Question::TRACKS)],
            'q' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('question_bank.pagination.max_per_page')],
        ];
    }
}
