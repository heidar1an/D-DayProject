<?php

namespace App\Http\Requests\QuestionBank\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Models\Question;
use Illuminate\Validation\Rule;

/**
 * ساخت سؤال (ادمین).
 *
 * **آنچه نمی‌تواند از کلاینت بیاید و در rules نیست:**
 * `status` (فقط publish/archive)، `version`، `author_admin_id` (از سشن ادمین)،
 * `published_at`، `legacy_id` (فقط مهاجرت داده)، `correct_option_id` (از
 * `key.correctPosition` مشتق می‌شود).
 */
class StoreQuestionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'subject_id' => ['required', 'uuid', 'exists:subjects,id'],
            'chapter_id' => ['nullable', 'uuid', 'exists:chapters,id'],
            'lesson_id' => ['nullable', 'uuid', 'exists:lessons,id'],
            'topic_id' => ['nullable', 'uuid', 'exists:question_topics,id'],

            'stem' => ['required', 'string', 'max:5000'],
            'figure_key' => ['nullable', 'string', 'max:190'],
            'type' => ['required', Rule::in(Question::TYPES)],
            'difficulty' => ['required', Rule::in(Question::DIFFICULTIES)],
            'source' => ['required', Rule::in(Question::SOURCES)],
            'track' => ['required', Rule::in(Question::TRACKS)],
            'year' => ['nullable', 'integer', 'min:1300', 'max:1500'],
            'exam_month' => ['nullable', 'integer', 'min:1', 'max:12'],

            'options' => ['required', 'array', 'min:2', 'max:'.(int) config('question_bank.limits.max_options')],
            'options.*.label' => ['nullable', 'string', 'max:8'],
            'options.*.body' => ['required', 'string', 'max:2000'],

            'key.correctPosition' => ['required', 'integer', 'min:1'],
            'key.explanation' => ['nullable', 'array'],
        ];
    }
}
