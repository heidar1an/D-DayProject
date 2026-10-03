<?php

namespace App\Http\Requests\Knowledge\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * فهرست نودها برای پنل — شامل draft/archived (برخلاف سطح عمومی).
 */
class AdminListKnowledgeNodesRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public const SORTS = ['label', 'created_at'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['status', 'kind', 'q', 'sort', 'page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::in(config('knowledge.nodes.statuses'))],
            'kind' => ['nullable', Rule::in(config('knowledge.nodes.kinds'))],
            'q' => ['nullable', 'string', 'max:120'],
            'sort' => ['nullable', Rule::in(self::SORTS)],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('wiki.pagination.max_per_page')],
        ];
    }
}
