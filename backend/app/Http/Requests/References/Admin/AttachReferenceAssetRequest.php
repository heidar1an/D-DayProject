<?php

namespace App\Http\Requests\References\Admin;

use App\Http\Requests\ApiFormRequest;

/**
 * اتصال Media به مرجع — فاز ۱۵ (§13).
 */
final class AttachReferenceAssetRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'mediaId' => ['required', 'uuid', 'exists:media,id'],
            'key' => ['nullable', 'string', 'max:'.(int) config('references.asset_key_max'), 'regex:/^[a-z0-9-]*$/'],
        ];
    }
}
