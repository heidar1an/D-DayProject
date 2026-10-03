<?php

namespace App\Http\Resources;

use App\Models\Flashcard;
use App\Models\FlashcardReview;
use App\Models\FlashcardState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * نتیجهٔ ثبت مرور.
 *
 * payload: `['card' => Flashcard, 'state' => FlashcardState,
 * 'review' => FlashcardReview, 'preview' => array]`.
 *
 * `preview` **بعد از** اعمال مرور محاسبه شده؛ یعنی فاصله‌هایی که کاربر اگر
 * همین حالا دوباره همان کارت را ببیند خواهد داشت. این عدد از سرور می‌آید تا
 * UI هرگز الگوریتم را تکرار نکند.
 */
class FlashcardReviewResultResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array{card: Flashcard, state: FlashcardState, review: FlashcardReview, preview: array<string, mixed>} $payload */
        $payload = $this->resource;

        return [
            'card_id' => $payload['card']->getKey(),
            'deck_id' => $payload['card']->deck_id,
            'state' => (new FlashcardStateResource($payload['state']))->resolve($request),
            'review' => (new FlashcardReviewResource($payload['review']))->resolve($request),
            'preview' => $payload['preview'] ?? [],
        ];
    }
}
