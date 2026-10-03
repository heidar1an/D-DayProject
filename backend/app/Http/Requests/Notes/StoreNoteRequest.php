<?php

namespace App\Http\Requests\Notes;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * ساخت/ویرایش یادداشت — فاز ۱۶ (§32/§33).
 *
 * `userId` در قرارداد نیست — مالکیت فقط از سشن (§28/§32).
 */
final class StoreNoteRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $isUpdate = $this->isMethod('PATCH');
        $required = $isUpdate ? 'sometimes' : 'required';

        return [
            'kind' => [$isUpdate ? 'sometimes' : 'required', Rule::in((array) config('notes.kinds'))],
            'title' => [$required, 'nullable', 'string', 'max:'.(int) config('notes.note.title_max')],
            'body' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('notes.note.body_max')],
            'content' => ['sometimes', 'nullable', 'array'],
            'subjectId' => ['sometimes', 'nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'tags' => ['sometimes', 'nullable', 'array', 'max:'.(int) config('notes.note.tags_max')],
            'tags.*' => ['string', 'max:'.(int) config('notes.note.tag_max')],
            'color' => ['sometimes', 'nullable', Rule::in((array) config('notes.colors'))],
            'pinned' => ['sometimes', 'boolean'],
            'sourceType' => ['sometimes', 'nullable', Rule::in((array) config('notes.note_source_types'))],
            'sourceId' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('notes.note.source_id_max')],
            'sourceTitle' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('notes.note.source_title_max')],
        ];
    }
}
