<?php

namespace App\Policies;

use App\Models\FlashcardDeck;
use App\Models\User;

/**
 * مالکیت دک — لایهٔ دوم دفاعی.
 *
 * لایهٔ اول: هر کوئری با `FlashcardAccess` محدود می‌شود و هیچ مسیری
 * `userId` نمی‌پذیرد. این Policy تضمین می‌کند اگر روزی کوئری بدون scope نوشته
 * شد، دسترسی رد شود.
 *
 * دک رسمی (`owner_user_id = null`) برای کاربر **فقط خواندنی** است؛ تغییر و حذف
 * آن از مسیر ادمین انجام می‌شود.
 */
class FlashcardDeckPolicy
{
    public function view(User $user, FlashcardDeck $deck): bool
    {
        if ($deck->isOwnedBy($user)) {
            return true;
        }

        return $deck->isOfficial() && $deck->isPubliclyReadable();
    }

    public function update(User $user, FlashcardDeck $deck): bool
    {
        return $deck->isOwnedBy($user);
    }

    public function delete(User $user, FlashcardDeck $deck): bool
    {
        return $deck->isOwnedBy($user);
    }

    /** کلون فقط از دک **رسمی منتشرشده** مجاز است. */
    public function clone(User $user, FlashcardDeck $deck): bool
    {
        return $deck->isOfficial() && $deck->isPubliclyReadable();
    }
}
