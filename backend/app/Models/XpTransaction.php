<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * یک تراکنش XP — دفتر کل **نامتغیر** (فاز ۱۴).
 *
 * منبع حقیقت امتیاز. هیچ update/delete مسیری ندارد:
 *   • `$fillable` خالی است؛ ساخت فقط با `forceFill` در `XpService`.
 *   • مدل هر تلاش برای update/delete را با LogicException می‌شکند — همین قید
 *     در تست‌ها هم ثبت می‌شود.
 *   • تصحیح آینده = رکورد تازه با `admin_adjustment`، نه ویرایش گذشته.
 *
 * `request_key` UNIQUE است و از سمت سرور ساخته می‌شود
 * (`{source_type}:{source_id}`)؛ پس انتشار دوبارهٔ رویداد هرگز XP تکراری نمی‌سازد.
 */
class XpTransaction extends Model
{
    use HasUuids;

    public const SOURCE_PAGE_COMPLETED = 'page_completed';

    public const SOURCE_QUESTION_CORRECT = 'question_correct';

    public const SOURCE_EXAM_FINISHED = 'exam_finished';

    public const SOURCE_STUDY_SESSION = 'study_session';

    public const SOURCE_CHALLENGE_COMPLETED = 'challenge_completed';

    public const SOURCE_ADMIN_ADJUSTMENT = 'admin_adjustment';

    public $timestamps = false;

    protected $table = 'xp_transactions';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'delta' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException('xp_transactions is immutable.');
        });

        static::deleting(function (): void {
            throw new LogicException('xp_transactions is immutable.');
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function season(): BelongsTo
    {
        return $this->belongsTo(LeagueSeason::class, 'season_id');
    }
}
