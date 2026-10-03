<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * کلید پاسخ — جدول **جدا و محافظت‌شده**.
 *
 * اصل امنیتی: هیچ Resource عمومی و هیچ endpoint دانشجویی این مدل را serialize
 * نمی‌کند. تنها مصرف‌کننده‌ها:
 *   • `QuestionGradingService` برای محاسبهٔ درستی،
 *   • `QuestionRevealService` برای بازگشایی **پس از** ثبت پاسخ،
 *   • مسیرهای ادمین با مجوز `testbank.read`.
 *
 * `key_version` جدا از `questions.version` است: تغییر کلید یک تغییر حساس است و
 * باید مستقل قابل ردیابی باشد (audit فاز ۱۶).
 */
class QuestionKey extends Model
{
    use HasUuids;

    protected $table = 'question_keys';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'explanation' => 'array',
            'key_version' => 'integer',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function correctOption(): BelongsTo
    {
        return $this->belongsTo(QuestionOption::class, 'correct_option_id');
    }
}
