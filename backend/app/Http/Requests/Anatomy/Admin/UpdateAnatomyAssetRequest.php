<?php

namespace App\Http\Requests\Anatomy\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * ویرایش Anatomy Asset — part_key تغییرناپذیر است (هویت asset).
 */
final class UpdateAnatomyAssetRequest extends ApiFormRequest
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
            'partKey' => ['prohibited'],
            'mediaId' => ['sometimes', 'uuid'],
            'label' => ['sometimes', 'nullable', 'string', 'max:'.(int) config('anatomy.label_max')],
            'category' => ['sometimes', 'nullable', Rule::in((array) config('anatomy.categories'))],
            'subjectId' => ['sometimes', 'nullable', 'uuid', 'exists:subjects,id'],
            'expectedVersion' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
