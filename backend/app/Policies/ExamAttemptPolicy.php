<?php

namespace App\Policies;

use App\Models\ExamAttempt;
use App\Models\User;

/**
 * سیاست مالکیت Attempt.
 *
 * قاعده: **Attempt فقط برای صاحبش وجود دارد.** نه برای کاربر دیگری، نه برای مهمان.
 *
 * این Policy لایهٔ دوم است؛ لایهٔ اول خودِ Query است که همیشه `where('user_id', …)`
 * دارد. چرا هر دو: اگر روزی کسی Query را با `find($id)` بازنویسی کند (بازسازی
 * رایج و بی‌صدا)، Policy جلوی IDOR را می‌گیرد. تست
 * `ExamOwnershipTest` هر دو مسیر را می‌سنجد.
 */
class ExamAttemptPolicy
{
    public function view(User $user, ExamAttempt $attempt): bool
    {
        return $attempt->user_id !== null && (string) $attempt->user_id === (string) $user->getKey();
    }

    public function answer(User $user, ExamAttempt $attempt): bool
    {
        return $this->view($user, $attempt) && $attempt->isOpen();
    }

    public function finish(User $user, ExamAttempt $attempt): bool
    {
        return $this->view($user, $attempt);
    }
}
