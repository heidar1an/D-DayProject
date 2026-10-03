<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * فهرست Jobهای شکست‌خورده (Dead letter) — فاز ۲۰ (§10).
 */
final class ListFailedJobsRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['queue', 'connection', 'from', 'page', 'perPage']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'queue' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/i'],
            'connection' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/i'],
            'from' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('queue.tapesh.dead_letter.prune_batch', 200)],
        ];
    }
}
