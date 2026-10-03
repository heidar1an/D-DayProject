<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bank Session.
 *
 * سؤال‌ها با `QuestionResource` (شکل عمومی) می‌آیند، پس **کلید پاسخ در سشن
 * نیست** — نه در فهرست، نه در متادیتا. شناسهٔ سشن opaque و سرور-ساخته است.
 */
class BankSessionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array{session_id: string, mode: string, expires_at?: string|null, questions: list<mixed>} $session */
        $session = $this->resource;

        return [
            'session_id' => $session['session_id'],
            'mode' => $session['mode'],
            'expires_at' => $session['expires_at'] ?? null,
            'questions' => QuestionResource::collection($session['questions']),
        ];
    }
}
