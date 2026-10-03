<?php

namespace App\Http\Requests\Knowledge\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ساخت یال بین دو نود.
 *
 * `relation` از allowlist سرور (`config('knowledge.edges.relation_types')`) —
 * که خودش از `RELATION_TYPES` فرانت‌اند استخراج شده. self edge و یال تکراری در
 * سرویس و در دیتابیس رد می‌شوند.
 */
class StoreKnowledgeEdgeRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fromNodeId' => ['required', 'uuid'],
            'toNodeId' => ['required', 'uuid', 'different:fromNodeId'],
            'relation' => ['required', 'string', Rule::in(config('knowledge.edges.relation_types'))],
            'weight' => ['nullable', 'numeric', 'min:0', 'max:'.(float) config('knowledge.edges.max_weight')],
        ];
    }
}
