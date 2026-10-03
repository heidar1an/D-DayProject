<?php

namespace App\Http\Resources;

use App\Models\FlashcardDeck;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * دک فلش‌کارت.
 *
 * `owner_user_id` **عمداً serialize نمی‌شود**: کتابخانهٔ رسمی نباید شناسهٔ کاربر
 * را لو بدهد و برای دک شخصی هم کلاینت فقط باید بداند «مال من است یا نه».
 * `is_official` و `is_owned` همان دو واقعیتی هستند که UI لازم دارد.
 */
class FlashcardDeckResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var FlashcardDeck $deck */
        $deck = $this->resource;
        $user = $request->user();

        return [
            'id' => $deck->getKey(),
            'title' => $deck->title,
            'description' => $deck->description,
            'status' => $deck->status,
            'visibility' => $deck->visibility,
            'is_official' => $deck->isOfficial(),
            'is_owned' => $user !== null && $deck->isOwnedBy($user),
            'cards_count' => $deck->cards_count === null ? null : (int) $deck->cards_count,
            'version' => (int) $deck->version,
            'published_at' => $deck->published_at?->toIso8601String(),
            'created_at' => $deck->created_at?->toIso8601String(),
            'updated_at' => $deck->updated_at?->toIso8601String(),
        ];
    }
}
