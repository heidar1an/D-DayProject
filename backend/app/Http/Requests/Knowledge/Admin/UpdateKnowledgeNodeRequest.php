<?php

namespace App\Http\Requests\Knowledge\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ویرایش نود — فقط label/kind/پیوند مقاله. `status` اینجا نیست.
 */
class UpdateKnowledgeNodeRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'label' => ['sometimes', 'required', 'string', 'max:'.(int) config('knowledge.nodes.label_max')],
            'kind' => ['sometimes', 'required', 'string', Rule::in(config('knowledge.nodes.kinds'))],
            'wikiArticleId' => ['sometimes', 'nullable', 'uuid'],
        ];
    }
}
