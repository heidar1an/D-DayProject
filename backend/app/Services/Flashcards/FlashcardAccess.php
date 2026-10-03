<?php

namespace App\Services\Flashcards;

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * مرز دسترسی Flashcards — تنها جایی که «کدام دک/کارت برای این کاربر دیده می‌شود»
 * تعریف می‌شود.
 *
 * قواعد:
 *   • دک **رسمی** (`owner_user_id = null`) اگر منتشرشده و عمومی باشد برای همه
 *     خواندنی است.
 *   • دک **شخصی** فقط برای مالکش دیده می‌شود — حتی اگر `visibility = public`
 *     باشد. در این فاز `public` روی دک شخصی فقط یک انتخاب ذخیره‌شده برای جریان
 *     اشتراک‌گذاری آینده است؛ تا وقتی مصرف‌کنندهٔ واقعی نداشته باشد، خواندن
 *     بین‌کاربری باز نمی‌شود. محافظه‌کارانه‌تر از spec، و عمدی.
 *   • تغییر فقط برای مالک (و برای دک رسمی فقط ادمین با مجوز).
 *
 * ⚠️ هیچ متدی `userId` از URL/بدنه نمی‌گیرد؛ هویت فقط `User` سشن است.
 */
class FlashcardAccess
{
    /**
     * شناسهٔ دک‌های قابل‌خواندن برای این کاربر.
     *
     * @return list<string>
     */
    public function visibleDeckIds(User $user): array
    {
        return $this->visibleDecks($user)->pluck('id')->all();
    }

    /** @return Builder<FlashcardDeck> */
    public function visibleDecks(User $user): Builder
    {
        return FlashcardDeck::query()->where(function (Builder $query) use ($user): void {
            $query->where('owner_user_id', $user->getKey())
                ->orWhere(function (Builder $official): void {
                    $official->whereNull('owner_user_id')
                        ->where('status', FlashcardDeck::STATUS_PUBLISHED)
                        ->where('visibility', FlashcardDeck::VISIBILITY_PUBLIC);
                });
        });
    }

    public function canReadDeck(User $user, FlashcardDeck $deck): bool
    {
        return $deck->isOwnedBy($user) || $deck->isOfficial() && $deck->isPubliclyReadable();
    }

    public function canMutateDeck(User $user, FlashcardDeck $deck): bool
    {
        return $deck->isOwnedBy($user);
    }

    /**
     * آیا این کارت برای این کاربر قابل مرور است؟
     *
     * سه شرط: دک قابل‌خواندن، کارت `active`، و دک فعال (آرشیو/پیش‌نویسِ خودِ
     * کاربر هم قابل مرور نیست چون کارت‌ها هنوز منتشر نشده‌اند).
     */
    public function canReviewCard(User $user, Flashcard $card): bool
    {
        $deck = $card->deck;

        if (! $deck instanceof FlashcardDeck) {
            return false;
        }

        if (! $card->isReviewable()) {
            return false;
        }

        if ($deck->isOwnedBy($user)) {
            return $deck->status !== FlashcardDeck::STATUS_ARCHIVED;
        }

        return $deck->isPubliclyReadable();
    }

    public function canMutateCard(User $user, Flashcard $card): bool
    {
        $deck = $card->deck;

        return $deck instanceof FlashcardDeck && $deck->isOwnedBy($user);
    }
}
