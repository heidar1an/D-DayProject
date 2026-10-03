<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * گزارش کاربر دربارهٔ یک سؤال.
 *
 * `kind` = همان پنج دستهٔ قابل‌اثبات در UI فعلی: خطا / ابهام / غلط تایپی /
 * پاسخ اشتباه / سایر. دستهٔ تازه بدون مصرف‌کنندهٔ واقعی اضافه نشد.
 *
 * `user_id` nullable است چون گزارش می‌تواند از مسیر مهمان هم بیاید (فاز ۷)؛ در
 * این فاز فقط مسیر احرازشده وجود دارد.
 */
class QuestionReport extends Model
{
    use HasUuids;

    public const KINDS = ['error', 'ambiguity', 'typo', 'wrong_answer', 'other'];

    public const STATUS_OPEN = 'open';

    public const STATUS_REVIEWING = 'reviewing';

    public const STATUS_RESOLVED = 'resolved';

    protected $table = 'question_reports';

    /**
     * `status` و `resolved_at` در `$fillable` نیستند: وضعیت را فقط بررسی ادمین
     * (فاز ۱۶) تغییر می‌دهد، نه گزارش‌دهنده.
     *
     * @var list<string>
     */
    protected $fillable = ['kind', 'body'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
