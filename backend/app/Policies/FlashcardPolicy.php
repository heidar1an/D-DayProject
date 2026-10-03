<?php

namespace App\Policies;

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\User;

/**
 * مالکیت کارت.
 *
 * خواندن: کارت داخل دک مجاز (شخصیِ مالک یا رسمیِ منتشرشده).
 * نوشتن: فقط کارت داخل دک **شخصی خودِ** کاربر.
 * مرور: کارت `active` داخل دک مجاز و فعال.
 *
 * ⚠️ هیچ‌کدام `cardId` را «منبع مجوز» نمی‌گیرند؛ مالکیت از `deck.owner_user_id`
 * خوانده می‌شود، نه از URL.
 */
class FlashcardPolicy
{
    public function view(User $user, Flashcard $card): bool
    {
        $deck = $card->deck;

        if (! $deck instanceof FlashcardDeck) {
            return false;
        }

        return $deck->isOwnedBy($user) || ($deck->isOfficial() && $deck->isPubliclyReadable());
    }

    public function update(User $user, Flashcard $card): bool
    {
        return $this->owns($user, $card);
    }

    public function delete(User $user, Flashcard $card): bool
    {
        return $this->owns($user, $card);
    }

    public function review(User $user, Flashcard $card): bool
    {
        $deck = $card->deck;

        if (! $deck instanceof FlashcardDeck || ! $card->isReviewable()) {
            return false;
        }

        if ($deck->isOwnedBy($user)) {
            return $deck->status !== FlashcardDeck::STATUS_ARCHIVED;
        }

        return $deck->isPubliclyReadable();
    }

    private function owns(User $user, Flashcard $card): bool
    {
        $deck = $card->deck;

        return $deck instanceof FlashcardDeck && $deck->isOwnedBy($user);
    }
}
