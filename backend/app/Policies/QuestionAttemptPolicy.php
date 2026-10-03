<?php

namespace App\Policies;

use App\Models\QuestionAttempt;
use App\Models\User;

/**
 * مالکیت تلاش سؤال — لایهٔ دوم دفاعی.
 *
 * لایهٔ اول: هر query با `user_id` سشن محدود می‌شود و مسیر
 * `GET /users/{id}/attempts` وجود ندارد. این Policy تضمین می‌کند اگر روزی کسی
 * کوئری را بدون scope نوشت، دسترسی رد شود.
 */
class QuestionAttemptPolicy
{
    public function view(User $user, QuestionAttempt $attempt): bool
    {
        return $this->owns($user, $attempt);
    }

    private function owns(User $user, QuestionAttempt $attempt): bool
    {
        // تلاش مهمان (فاز ۷) مالک کاربر نیست و از مسیر دانشجو دیده نمی‌شود.
        return $attempt->user_id !== null
            && (string) $attempt->user_id === (string) $user->getKey();
    }
}
