<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * نتیجهٔ تصحیح‌شدهٔ یک Attempt — فاز ۷.
 *
 * **تغییرن‌پذیر (immutable):** بعد از درج، هیچ فیلد محاسبه‌شده‌ای overwrite
 * نمی‌شود. نه soft delete دارد، نه مسیر update. اگر روزی «اصلاح نمره» لازم شد،
 * باید یک workflow رسمی Correction در فاز ادمین ساخته شود که رکورد تازه با
 * ارجاع به قبلی بسازد — نه ویرایش در جای خود.
 *
 * همهٔ اعداد اینجا **سرور-مشتق** هستند: از `exam_questions` snapshot و
 * `exam_answers` و `rules` آزمون. هیچ‌کدام از بدنهٔ درخواست نمی‌آید.
 *
 * `UNIQUE(attempt_id)` تضمین می‌کند double finish هرگز دو نتیجه نسازد.
 */
class ExamResult extends Model
{
    use HasUuids;

    protected $table = 'exam_results';

    /** هیچ‌کدام از این‌ها از ورودی پر نمی‌شوند؛ فقط `forceFill` در `ExamGrader`. */
    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'score' => 'float',
            'max_score' => 'float',
            'percentage' => 'float',
            'negative_marking' => 'float',
            'correct_count' => 'integer',
            'wrong_count' => 'integer',
            'blank_count' => 'integer',
            'time_spent_sec' => 'integer',
            'subject_breakdown' => 'array',
            'graded_at' => 'datetime',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
