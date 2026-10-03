<?php

namespace App\Http\Resources;

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * یک آیتم صف مرور.
 *
 * payload مورد انتظار: `['card' => Flashcard, 'state' => ?FlashcardState,
 * 'preview' => array]`. `state` برای کارت نو `null` است و `preview` فاصله‌های
 * چهار rating را از **سرور** می‌دهد؛ UI هیچ محاسبه‌ای نمی‌کند.
 */
class FlashcardQueueItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array{card: Flashcard, state: ?FlashcardState, preview: array<string, mixed>} $payload */
        $payload = $this->resource;

        $card = $payload['card'];
        $state = $payload['state'] ?? null;
        $deck = $card->relationLoaded('deck') ? $card->deck : null;

        return [
            'card' => [
                'id' => $card->getKey(),
                'deck_id' => $card->deck_id,
                'front' => $card->front,
                'back' => $card->back,
                'position' => (int) $card->position,
                'status' => $card->status,
            ],
            'deck' => $deck instanceof FlashcardDeck ? [
                'id' => $deck->getKey(),
                'title' => $deck->title,
                'is_official' => $deck->isOfficial(),
            ] : null,
            'state' => $state instanceof FlashcardState
                ? (new FlashcardStateResource($state))->resolve($request)
                : null,
            'preview' => $payload['preview'] ?? [],
        ];
    }
}
