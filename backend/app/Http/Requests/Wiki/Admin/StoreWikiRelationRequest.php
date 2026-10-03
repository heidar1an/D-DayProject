<?php

namespace App\Http\Requests\Wiki\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * ساخت رابطه بین دو مقاله.
 *
 * `kind` از allowlist سرور (`config('wiki.relations.kinds')`) — که خودش از
 * `RELATIONS` فرانت‌اند استخراج شده. self relation در سرویس و در دیتابیس رد
 * می‌شود (§32).
 */
class StoreWikiRelationRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fromArticleId' => ['required', 'uuid'],
            'toArticleId' => ['required', 'uuid'],
            'kind' => ['required', 'string', Rule::in(config('wiki.relations.kinds'))],
        ];
    }
}
