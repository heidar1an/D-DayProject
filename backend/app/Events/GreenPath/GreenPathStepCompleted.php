<?php

namespace App\Events\GreenPath;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * یک قدم مسیر سبز تکمیل شد — فاز ۱۳.
 *
 * دو مسیر تولید: (۱) گذار موتور از رخداد واقعی یادگیری، (۲) تکمیل قدم action
 * توسط کاربر. هیچ XP مستقیماً از این رویداد نمی‌آید — مالک XP رخدادهای
 * یادگیری واقعی (Lesson/Question/Exam/StudySession) است؛ این رویداد فقط
 * مصرف‌کنندهٔ چالش‌ها و تحلیل است.
 */
final class GreenPathStepCompleted
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $stepId,
        public readonly string $kind,
    ) {}
}
