<?php

namespace App\Services\QuestionBank;

use App\Events\QuestionBank\QuestionReported;
use App\Exceptions\ApiErrorException;
use App\Models\Question;
use App\Models\QuestionReport;
use App\Models\User;

/**
 * ثبت گزارش سؤال — تنها نویسندهٔ `question_reports`.
 *
 * قواعد:
 *   • سؤال باید برای کاربر **قابل مشاهده** باشد (منتشرشده) ⇒ گزارش روی سؤال
 *     دیده‌نشده ممکن نیست.
 *   • `kind` از allowlist پنج‌مقداری می‌آید (همان دسته‌های UI فعلی).
 *   • `body` سقف طول دارد؛ متن خام کاربر در لاگ نمی‌رود.
 *   • `status` و `resolved_at` را گزارش‌دهنده تعیین نمی‌کند (در `$fillable` نیست).
 */
class QuestionReportService
{
    public function create(User $user, string $questionId, array $data): QuestionReport
    {
        $exists = Question::query()->published()->where('id', $questionId)->exists();

        if (! $exists) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Question not found.');
        }

        $report = new QuestionReport;
        $report->forceFill([
            'user_id' => $user->getKey(),
            'question_id' => $questionId,
            'kind' => (string) $data['kind'],
            'status' => QuestionReport::STATUS_OPEN,
            'body' => $data['body'] ?? null,
        ])->save();

        QuestionReported::dispatch($user->getKey(), $questionId, $report->getKey(), $report->kind);

        return $report;
    }
}
