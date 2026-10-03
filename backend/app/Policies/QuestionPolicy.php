<?php

namespace App\Policies;

use App\Models\Admin;
use App\Models\Question;

/**
 * Policy سؤال — سه سطح دسترسی، بدون entitlement واقعی.
 *
 *   • Public    : سؤال `published` را همه (حتی مهمان) می‌بینند.
 *   • Authenticated : دانشجو همان public را می‌بیند + امکان پاسخ.
 *   • Restricted/Premium : **فعال نیست**. `EntitlementGate` امروز no-op است؛
 *     فاز ۱۸ آن را پر می‌کند. Mock کردن پرداخت ممنوع است.
 *
 * مجوز ادمین اینجا چک **نمی‌شود**؛ آن کار middleware `api.can:testbank.*` است.
 * این Policy فقط «قابلیت مشاهدهٔ سؤال» را تعریف می‌کند و در مسیر دانشجو
 * استفاده می‌شود.
 */
class QuestionPolicy
{
    /**
     * `$actor` عمداً بدون type است: در این معماری Gate ممکن است با دانشجو
     * (`User`) یا ادمین (`Admin`) یا حتی مهمان (`null`) صدا زده شود و هر سه باید
     * یک پاسخ بگیرند — «سؤال منتشرشده برای همه قابل مشاهده است».
     */
    public function view(mixed $actor, Question $question): bool
    {
        return $question->status === Question::STATUS_PUBLISHED;
    }

    /**
     * پاسخ‌دادن روی سؤال پیش‌نویس/آرشیوشده ممنوع است.
     * در این فاز فقط دانشجوی احرازشده مسیر پاسخ دارد.
     */
    public function answer(mixed $actor, Question $question): bool
    {
        return $question->status === Question::STATUS_PUBLISHED;
    }
}
