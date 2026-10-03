<?php

namespace App\Policies;

use App\Models\QuestionReport;
use App\Models\User;

/**
 * مالکیت گزارش سؤال.
 *
 * کاربر فقط گزارش خودش را می‌بیند. مسیر عمومی «فهرست گزارش‌ها» در این فاز وجود
 * ندارد؛ فقط ثبت. مشاهده/تغییر وضعیت کار ادمین با مجوز `feedback.manage` است.
 */
class QuestionReportPolicy
{
    public function view(User $user, QuestionReport $report): bool
    {
        return $report->user_id !== null && (string) $report->user_id === (string) $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }
}
