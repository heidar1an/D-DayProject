<?php

namespace App\Policies;

use App\Models\FlashcardState;
use App\Models\User;

/**
 * مالکیت وضعیت یادگیری.
 *
 * وضعیت هر کاربر فقط برای خودش است. هیچ مسیری برای خواندن وضعیت کاربر دیگر
 * وجود ندارد و این Policy تضمین می‌کند حتی با شناسهٔ حدس‌زده‌شده هم دسترسی
 * داده نشود.
 */
class FlashcardStatePolicy
{
    public function view(User $user, FlashcardState $state): bool
    {
        return $this->owns($user, $state);
    }

    public function update(User $user, FlashcardState $state): bool
    {
        return $this->owns($user, $state);
    }

    private function owns(User $user, FlashcardState $state): bool
    {
        return $state->user_id !== null
            && (string) $state->user_id === (string) $user->getKey();
    }
}
