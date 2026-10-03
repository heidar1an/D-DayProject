<?php

namespace App\Http\Resources;

use App\Models\FlashcardReview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * یک رکورد تاریخچهٔ مرور — **immutable**.
 *
 * `previous_*` و `next_*` هر دو نمایش داده می‌شوند تا «چرا این فاصله انتخاب شد»
 * از خودِ داده قابل بازبینی باشد، بدون نیاز به محاسبهٔ دوباره با الگوریتم.
 */
class FlashcardReviewResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var FlashcardReview $review */
        $review = $this->resource;

        return [
            'id' => $review->getKey(),
            'state_id' => $review->state_id,
            'rating' => $review->rating,
            'previous_state' => $review->previous_state,
            'new_state' => $review->new_state,
            'previous_due_at' => $review->previous_due_at?->toIso8601String(),
            'next_due_at' => $review->next_due_at?->toIso8601String(),
            'previous_interval_minutes' => $review->previous_interval_minutes === null ? null : (int) $review->previous_interval_minutes,
            'next_interval_minutes' => (int) $review->next_interval_minutes,
            'previous_ease' => $review->previous_ease === null ? null : (float) $review->previous_ease,
            'next_ease' => (float) $review->next_ease,
            'algorithm_version' => $review->algorithm_version,
            'reviewed_at' => $review->reviewed_at?->toIso8601String(),
        ];
    }
}
