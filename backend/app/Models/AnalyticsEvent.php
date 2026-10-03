<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * رویداد تحلیلی — فاز ۸.
 *
 * این جدول **مشتق** است، نه منبع حقیقت. برای Completion و نمره همیشه از
 * `learning_progress`/`exam_results` خوانده می‌شود؛ رویداد فقط برای «جریان
 * فعالیت» و «روند زمانی» به کار می‌آید.
 *
 * `event_key` یکتا = dedup. اگر یک Domain Event دو بار publish شود (at-least-once
 * بودن listener ها)، درج دوم بی‌اثر است.
 *
 * هیچ مسیری برای نوشتن از سمت کلاینت وجود ندارد؛ تنها نویسنده
 * `AnalyticsEventRecorder` است که از listener سمت سرور صدا زده می‌شود.
 */
class AnalyticsEvent extends Model
{
    use HasUuids;

    protected $table = 'analytics_events';

    /** همه از سرویس می‌آیند؛ مدل خودش هیچ ورودی درخواستی نمی‌پذیرد. */
    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'properties' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
