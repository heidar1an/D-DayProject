<?php

namespace App\Http\Requests\Knowledge\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ساخت نود.
 *
 * `status` در این Request **موجود نیست** — عمداً. نود همیشه draft ساخته می‌شود
 * و انتشار فقط از مسیر publish با مجوز `articles.publish` است (§27 مرز اعتماد).
 */
class StoreKnowledgeNodeRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:'.(int) config('knowledge.nodes.label_max')],
            'kind' => ['required', 'string', Rule::in(config('knowledge.nodes.kinds'))],
            'wikiArticleId' => ['nullable', 'uuid'],
        ];
    }
}
