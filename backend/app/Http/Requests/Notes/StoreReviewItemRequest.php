<?php

namespace App\Http\Requests\Notes;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * ساخت/ویرایش آیتم مرور — فاز ۱۶ (§35/§36). `sourceType` allowlist دارد؛
 * `stage`/`status`/`dueAt` از بدنه نمی‌آیند — سرور محاسبه می‌کند.
 */
final class StoreReviewItemRequest extends ApiFormRequest
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

        return [
            'sourceType' => [$isUpdate ? 'sometimes' : 'required', Rule::in((array) config('notes.review_source_types'))],
            'sourceId' => [$isUpdate ? 'sometimes' : 'nullable', 'string', 'max:'.(int) config('notes.review.source_id_max')],
            'title' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:'.(int) config('notes.review.title_max')],
            'subject' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('notes.review.subject_max')],
            'description' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('notes.review.description_max')],
            'activityType' => [$isUpdate ? 'sometimes' : 'required', Rule::in((array) config('notes.activity_types'))],
        ];
    }
}
