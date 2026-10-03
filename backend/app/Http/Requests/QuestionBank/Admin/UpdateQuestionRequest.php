<?php

namespace App\Http\Requests\QuestionBank\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Models\Question;
use Illuminate\Validation\Rule;

/**
 * ویرایش سؤال (ادمین).
 *
 * `version` **اجباری** است: ویرایش هم‌زمان دو ادمین نباید بی‌صدا نوشتن دیگری را
 * پاک کند. عدم تطابق ⇒ ۴۰۹ (در سرویس چک می‌شود چون نسخه را دیتابیس نگه می‌دارد).
 */
class UpdateQuestionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:1'],
            'subject_id' => ['sometimes', 'uuid', 'exists:subjects,id'],
            'chapter_id' => ['sometimes', 'nullable', 'uuid', 'exists:chapters,id'],
            'lesson_id' => ['sometimes', 'nullable', 'uuid', 'exists:lessons,id'],
            'topic_id' => ['sometimes', 'nullable', 'uuid', 'exists:question_topics,id'],

            'stem' => ['sometimes', 'string', 'max:5000'],
            'figure_key' => ['sometimes', 'nullable', 'string', 'max:190'],
            'type' => ['sometimes', Rule::in(Question::TYPES)],
            'difficulty' => ['sometimes', Rule::in(Question::DIFFICULTIES)],
            'source' => ['sometimes', Rule::in(Question::SOURCES)],
            'track' => ['sometimes', Rule::in(Question::TRACKS)],
            'year' => ['sometimes', 'nullable', 'integer', 'min:1300', 'max:1500'],
            'exam_month' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:12'],

            'options' => ['sometimes', 'array', 'min:2', 'max:'.(int) config('question_bank.limits.max_options')],
            'options.*.label' => ['nullable', 'string', 'max:8'],
            'options.*.body' => ['required_with:options', 'string', 'max:2000'],

            'key' => ['sometimes', 'array'],
            'key.correctPosition' => ['required_with:key', 'integer', 'min:1'],
            'key.explanation' => ['nullable', 'array'],
        ];
    }
}
