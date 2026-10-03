<?php

namespace App\Http\Requests\Wiki;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * پیشنهاد زنده (autocomplete).
 *
 * `q` اجباری و حداقل طول دارد و `limit` سقف سخت — autocomplete نباید به یک
 * dump از دیتابیس تبدیل شود (§31).
 */
class SuggestWikiRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['q', 'limit'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(self::ALLOWED);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:'.(int) config('wiki.search.suggest_min_query_length'), 'max:'.(int) config('wiki.search.max_query_length')],
            'limit' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('wiki.search.suggest_limit_max')],
        ];
    }
}
