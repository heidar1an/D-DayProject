<?php

namespace App\Models;

use Database\Factories\LearningProgressFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * پیشرفت کاربر روی یک **صفحهٔ درس** — فاز ۵.
 *
 * معنای دقیق هر ستون (قرارداد، نه تفسیر آزاد):
 *   • `status`        : `not_started` | `in_progress` | `completed`. تنها مرجع،
 *                       سرور است. `completed` **چسبنده** است: بدون یک عملیات
 *                       reset صریح (که در این فاز وجود ندارد) به عقب برنمی‌گردد.
 *   • `last_position` : آخرین محل مطالعه در صفحه. **یکنوا نیست** — کاربر
 *                       می‌تواند به عقب برگردد؛ فقط در بازهٔ مجاز clamp می‌شود.
 *   • `seconds_spent` : مجموع ثانیه‌های واقعی مطالعه. در هر درخواست فقط یک
 *                       **دلتا**ی محدود اضافه می‌شود، پس نه با timestamp جعلی
 *                       بالا می‌رود و نه بی‌نهایت می‌شود.
 *   • `version`       : نسخهٔ رکورد برای optimistic lock. فقط سرویس آن را
 *                       بالا می‌برد؛ در `$fillable` نیست.
 *   • `completed_at`  : یک‌بار و فقط در گذار به `completed` نوشته می‌شود.
 */
class LearningProgress extends Model
{
    /** @use HasFactory<LearningProgressFactory> */
    use HasFactory, HasUuids;

    public const STATUS_NOT_STARTED = 'not_started';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    protected $table = 'learning_progress';

    /**
     * فقط همین سه ستون از آرایهٔ ورودی قابل پر شدن‌اند.
     *
     * `user_id`، `lesson_page_id`، `version` و `completed_at` عمداً غایب‌اند:
     * مالکیت از سشن می‌آید، نسخه را سرویس می‌سازد و زمان تکمیل را سرور تعیین
     * می‌کند. هیچ‌کدام هرگز از درخواست خوانده نمی‌شوند.
     *
     * @var list<string>
     */
    protected $fillable = ['status', 'last_position', 'seconds_spent'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'last_position' => 'integer',
            'seconds_spent' => 'integer',
            'version' => 'integer',
            'completed_at' => 'datetime',
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

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }
}
