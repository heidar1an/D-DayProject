<?php

namespace App\Models;

use Database\Factories\StudySessionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * یک بازهٔ واقعی مطالعه — فاز ۵.
 *
 * مستقل از `learning_progress` است: نشست می‌تواند به یک صفحه گره بخورد یا
 * نخورد (`lesson_page_id` nullable). مدت هم می‌تواند تا باز بودن نشست تهی بماند.
 *
 * هیچ‌کدام از `started_at`/`ended_at`/`duration_sec` «هرچه کلاینت گفت» نیست:
 * `StudySessionService` آن‌ها را روی ساعت سرور اعتبارسنجی می‌کند.
 *
 * `$fillable` خالی است و ساخت فقط با `forceFill` در سرویس انجام می‌شود — سخت‌گیرانه
 * ترین حالت ممکن در برابر mass assignment.
 */
class StudySession extends Model
{
    /** @use HasFactory<StudySessionFactory> */
    use HasFactory, HasUuids;

    public const SOURCE_LESSON = 'lesson';

    public const SOURCE_MICRO_LESSON = 'micro_lesson';

    public const SOURCE_POMODORO = 'pomodoro';

    protected $table = 'study_sessions';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'duration_sec' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lessonPage(): BelongsTo
    {
        return $this->belongsTo(LessonPage::class);
    }
}
