<?php

namespace App\Policies;

use App\Models\LearningProgress;
use App\Models\User;

/**
 * مالکیت پیشرفت — لایهٔ دوم.
 *
 * لایهٔ اول این است که **هر** query با `user_id` سشن محدود می‌شود؛ پس رسیدن به
 * رکورد کاربر دیگر از مسیر عادی ممکن نیست. این Policy لایهٔ دفاعی دوم است تا اگر
 * روزی کسی کوئری را بدون scope نوشت، دسترسی رد شود نه افشا.
 */
class ProgressPolicy
{
    public function view(User $user, LearningProgress $progress): bool
    {
        return $this->owns($user, $progress);
    }

    public function update(User $user, LearningProgress $progress): bool
    {
        return $this->owns($user, $progress);
    }

    private function owns(User $user, LearningProgress $progress): bool
    {
        return (string) $progress->user_id === (string) $user->getKey();
    }
}
