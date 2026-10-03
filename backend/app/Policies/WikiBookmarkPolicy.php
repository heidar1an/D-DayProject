<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WikiBookmark;

/**
 * مالکیت نشان‌گذاری — تضمین IDOR (§40).
 *
 * لایهٔ اول: هر کوئری با `user_id` سشن محدود می‌شود. این Policy تضمین می‌کند
 * حتی با شناسهٔ حدس‌زده‌شده هم نشان کاربر دیگر دیده/حذف نشود.
 */
class WikiBookmarkPolicy
{
    public function view(User $user, WikiBookmark $bookmark): bool
    {
        return $this->owns($user, $bookmark);
    }

    public function delete(User $user, WikiBookmark $bookmark): bool
    {
        return $this->owns($user, $bookmark);
    }

    private function owns(User $user, WikiBookmark $bookmark): bool
    {
        return $bookmark->user_id !== null
            && (string) $bookmark->user_id === (string) $user->getKey();
    }
}
