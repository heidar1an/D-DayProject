<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * پیشرفت فلش‌کارت — **مشتق** از `flashcard_states` و `flashcard_reviews`.
 *
 * payload: `array<string, int>`. هیچ status تازه‌ای اختراع نمی‌شود؛ همان
 * دسته‌های واقعی UI: نو، در حال یادگیری، سررسید، مرورشده امروز، مسلط، معلق.
 */
class FlashcardProgressResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array<string, int> $progress */
        $progress = $this->resource;

        return [
            'total' => (int) ($progress['total'] ?? 0),
            'new' => (int) ($progress['new'] ?? 0),
            'learning' => (int) ($progress['learning'] ?? 0),
            'due' => (int) ($progress['due'] ?? 0),
            'reviewed_today' => (int) ($progress['reviewed_today'] ?? 0),
            'mastered' => (int) ($progress['mastered'] ?? 0),
            'suspended' => (int) ($progress['suspended'] ?? 0),
        ];
    }
}
