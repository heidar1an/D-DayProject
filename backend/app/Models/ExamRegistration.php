<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ثبت‌نام کاربر در آزمون — فاز ۷.
 *
 * `UNIQUE(exam_id, user_id)` در دیتابیس تضمین می‌کند دو درخواست هم‌زمان
 * «ثبت‌نام دوباره» نسازند؛ سرویس هم پیش از insert چک می‌کند تا پیام خطای
 * کاربرپسند بدهد. مالکیت همیشه از سشن می‌آید — `user_id` هرگز از بدنه خوانده
 * نمی‌شود.
 */
class ExamRegistration extends Model
{
    use HasUuids;

    protected $table = 'exam_registrations';

    /** `user_id` و `registered_at` عمداً غایب‌اند: از سشن و ساعت سرور می‌آیند. */
    /** @var list<string> */
    protected $fillable = ['exam_id'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['registered_at' => 'datetime'];
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
