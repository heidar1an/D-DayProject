<?php

namespace App\Http\Resources;

use App\Models\Flashcard;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * کارت فلش‌کارت — تعریف محتوا، بدون وضعیت کاربر.
 *
 * هیچ دادهٔ کلید/پاسخ اینجا نیست (کارت فلش‌کارت کلید ندارد) و هیچ شناسهٔ کاربری
 * هم serialize نمی‌شود.
 */
class FlashcardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Flashcard $card */
        $card = $this->resource;

        return [
            'id' => $card->getKey(),
            'deck_id' => $card->deck_id,
            'front' => $card->front,
            'back' => $card->back,
            'position' => (int) $card->position,
            'status' => $card->status,
            'created_at' => $card->created_at?->toIso8601String(),
            'updated_at' => $card->updated_at?->toIso8601String(),
        ];
    }
}
