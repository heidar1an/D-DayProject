<?php

namespace App\Policies;

use App\Models\Exam;
use App\Models\User;

/**
 * سیاست نمایش آزمون.
 *
 * یک قاعده، و فقط یک قاعده: **آزمون draft/archived برای دانشجو وجود ندارد.**
 *
 * چرا ۴۰۴ و نه ۴۰۳: اگر «وجود دارد ولی دسترسی نداری» برگردانیم، فهرست
 * پیش‌نویس‌های ادمین از بیرون قابل شمارش می‌شود. سیاست این پروژه در
 * `ProgressService` هم همین است (`accessiblePage` ⇒ ۴۰۴).
 *
 * این Policy در `ExamQueryService::findVisible` استفاده می‌شود — نه به‌عنوان
 * تزئین، بلکه چون Query فیلتر را با `scopePubliclyVisible` انجام می‌دهد و این
 * لایهٔ دوم دفاع برای مسیرهایی است که مدل را از جای دیگری می‌گیرند.
 */
class ExamPolicy
{
    public function view(?User $user, Exam $exam): bool
    {
        return $exam->isPublished();
    }

    public function register(?User $user, Exam $exam): bool
    {
        return $user !== null && $exam->isPublished() && $exam->acceptsRegistrations();
    }

    /** مدیریت آزمون (ساخت/گذار وضعیت) — ادمین با مجوز واقعی پنل. */
    public function manage(User $user, Exam $exam): bool
    {
        return $user->can('testbank.update');
    }
}
