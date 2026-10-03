<?php

namespace App\Http\Requests\Anatomy\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * ساخت Anatomy Asset — فاز ۱۵ (§16).
 */
final class StoreAnatomyAssetRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $categories = (array) config('anatomy.categories');

        return [
            'mediaId' => ['required', 'uuid'],
            'partKey' => ['required', 'string', 'max:'.(int) config('anatomy.part_key_max'), 'regex:/^[A-Za-z0-9_.-]+$/', 'unique:anatomy_assets,part_key'],
            'label' => ['nullable', 'string', 'max:'.(int) config('anatomy.label_max')],
            'category' => ['nullable', Rule::in($categories)],
            'subjectId' => ['nullable', 'uuid', 'exists:subjects,id'],
        ];
    }
}
