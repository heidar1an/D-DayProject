<?php

namespace App\Http\Resources;

use App\Models\FlashcardState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * وضعیت یادگیری کاربر برای یک کارت.
 *
 * همهٔ اعداد **سرور-ساخته** هستند. `algorithm_version` صریحاً افشا می‌شود: کلاینت
 * باید بداند این وضعیت با کدام نسخه محاسبه شده و هرگز آن را تغییر ندهد (§14).
 */
class FlashcardStateResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var FlashcardState $state */
        $state = $this->resource;

        return [
            'card_id' => $state->card_id,
            'state' => $state->state,
            'algorithm_version' => $state->algorithm_version,
            'due_at' => $state->due_at?->toIso8601String(),
            'interval_days' => (float) $state->interval_days,
            'interval_minutes' => (int) $state->interval_minutes,
            'ease' => (float) $state->ease,
            'review_count' => (int) $state->review_count,
            'lapse_count' => (int) $state->lapse_count,
            'correct_count' => (int) $state->correct_count,
            'incorrect_count' => (int) $state->incorrect_count,
            'difficulty' => (float) $state->difficulty,
            'stability' => (float) $state->stability,
            'mastery_score' => (int) $state->mastery_score,
            'suspended' => (bool) $state->suspended,
            'buried_until' => $state->buried_until?->toIso8601String(),
            'bookmarked' => (bool) $state->bookmarked,
            'last_reviewed_at' => $state->last_reviewed_at?->toIso8601String(),
            'version' => (int) $state->version,
        ];
    }
}
