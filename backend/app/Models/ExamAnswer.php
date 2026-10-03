<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * پاسخِ ثبت‌شدهٔ کاربر به یک سؤالِ snapshotشده — فاز ۷.
 *
 * `selected_option_id` یک شناسهٔ **درون snapshot** است، نه FK به
 * `question_options`. دلیل: Snapshot باید از ویرایش بعدی بانک سؤال مستقل بماند.
 * اعتبار «گزینه متعلق به همین سؤال است» در سرویس با `ExamQuestion::optionIds()`
 * بررسی می‌شود؛ اگر گزینه از سؤال دیگری بیاید ⇒ ۴۲۲.
 *
 * `revision` قفل خوش‌بینانهٔ سطح پاسخ است: کلاینت نسخه‌ای را که دیده می‌فرستد و
 * عدم تطابق ⇒ ۴۰۹. مقدار `0` یعنی «هنوز پاسخی ثبت نشده».
 *
 * `UNIQUE(attempt_id, exam_question_id)` در دیتابیس تضمین می‌کند دو save هم‌زمان
 * دو رکورد نسازند.
 */
class ExamAnswer extends Model
{
    use HasUuids;

    protected $table = 'exam_answers';

    /** `revision` و `answered_at` از سرویس می‌آیند، نه از ورودی. */
    /** @var list<string> */
    protected $fillable = ['attempt_id', 'exam_question_id', 'selected_option_id', 'time_spent_sec'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'time_spent_sec' => 'integer',
            'answered_at' => 'datetime',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }

    public function examQuestion(): BelongsTo
    {
        return $this->belongsTo(ExamQuestion::class);
    }
}
