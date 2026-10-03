<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * دورهٔ بین‌الملل — فاز ۱۷.
 *
 * ⚠️ این جدول **محتوای آموزشی نیست**. فصل/درس/صفحه اینجا ساخته نمی‌شود؛
 * محتوا مالکیت Content Engine است. اینجا فقط کاتالوگ + فرادادهٔ نمایشی است.
 *
 * `required_capability` تنها کلید دسترسی است: NULL = رایگان، مقداردار = فقط با
 * entitlement همان قابلیت. Content هرگز به Payment/Order/Subscription نگاه
 * نمی‌کند؛ فقط `EntitlementService::has()` را می‌پرسد (Prompt §91).
 */
class InternationalCourse extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'international_courses';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'sort_order' => 'integer',
            'duration_minutes' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(InternationalProvider::class, 'provider_id');
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    /** آیا این دوره پشت entitlement است؟ */
    public function isPremium(): bool
    {
        return is_string($this->required_capability) && $this->required_capability !== '';
    }

    /** @param Builder<InternationalCourse> $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', self::STATUS_PUBLISHED);
    }

    /**
     * زنجیرهٔ نمایش: دورهٔ منتشرشده زیر ناشر منتشرشده.
     *
     * همان قاعدهٔ `ContentVisibility`: پیش‌نویس ناشر، دوره‌اش را هم پنهان
     * می‌کند؛ وگرنه «انتشار ناشر» بی‌اثر می‌شد.
     *
     * @param  Builder<InternationalCourse>  $query
     */
    public function scopePubliclyVisible(Builder $query): void
    {
        $query->where('status', self::STATUS_PUBLISHED)
            ->whereHas('provider', fn ($inner) => $inner->where('status', InternationalProvider::STATUS_PUBLISHED));
    }
}
