<?php

namespace App\Http\Requests\Ai;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

final class ChatRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery([]);
    }

    public function rules(): array
    {
        return [
            'conversationId' => ['nullable', 'uuid'],
            'message' => ['required', 'string', 'min:1', 'max:'.config('ai.limits.message_chars')],
            'mode' => ['sometimes', Rule::in(['general', 'study', 'medical', 'quiz'])],
            'attachmentIds' => ['sometimes', 'array', 'max:'.config('ai.limits.attachments')],
            'attachmentIds.*' => ['required', 'uuid', 'distinct'],
            'userId' => ['prohibited'], 'role' => ['prohibited'], 'entitlement' => ['prohibited'],
            'quota' => ['prohibited'], 'provider' => ['prohibited'], 'history' => ['prohibited'],
            'context' => ['prohibited'], 'model' => ['prohibited'], 'score' => ['prohibited'],
        ];
    }
}
