<?php

namespace App\Events\Flashcards;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * رخداد «کارت مرور شد» — پس از **commit** منتشر می‌شود.
 *
 * چرا فقط شناسه و نه محتوا: شنوندهٔ تحلیل (فاز ۸) نباید محتوای پزشکی یا متن
 * کارت را ببیند. `mastery_score` یک عدد مشتق است، نه دادهٔ حساس.
 *
 * ⚠️ این رخداد منبع حقیقت نیست. منبع، `flashcard_reviews` است. اگر شنونده‌ای
 * شکست بخورد، مرور ثبت‌شده باقی می‌ماند (side-effect بعد از commit).
 */
class FlashcardReviewed
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $cardId,
        public readonly string $reviewId,
        public readonly string $rating,
        public readonly int $masteryScore,
    ) {}
}
