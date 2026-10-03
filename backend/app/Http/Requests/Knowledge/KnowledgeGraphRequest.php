<?php

namespace App\Http\Requests\Knowledge;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * پارامترهای گراف عمومی.
 *
 * همهٔ مقادیر allowlist سرور دارند: `kind`/`relation` از config (استخراج‌شده از
 * دادهٔ فرانت) و `depth` سقف سمت سرور دارد — کلاینت هرگز پیمایش بی‌کران
 * نمی‌گیرد (§13/§33).
 *
 * ⚠️ `limit` عمداً در allowlist نیست: سقف نود/یال «سقف امنیتی سرور» است، نه
 * پارامتر کلاینت. ارسال هر پارامتر ناشناخته ۴۰۰ می‌گیرد.
 */
class KnowledgeGraphRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['node', 'depth', 'kind', 'relation']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'node' => ['nullable', 'string', 'max:160'],
            'depth' => ['nullable', 'integer', 'min:0', 'max:'.(int) config('knowledge.graph.max_depth')],
            'kind' => ['nullable', Rule::in(config('knowledge.nodes.kinds'))],
            'relation' => ['nullable', Rule::in(config('knowledge.edges.relation_types'))],
        ];
    }
}
