<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;

/**
 * سؤالِ snapshotشده در یک آزمون — فاز ۷.
 *
 * چرا Snapshot و نه ارجاع زندهٔ سؤال: اگر ادمین بعد از انتشار آزمون متن سؤال یا
 * گزینه‌ها را ویرایش کند (Question V1 → V2)، Attempt های قبلی **نباید** تغییر
 * کنند. پس متن/گزینه/متادیتای نمایشی در `render_snapshot` کپی می‌شوند و گزینه‌ها
 * شناسهٔ درون‌snapshot خودشان را دارند (`option.id`).
 *
 * ⚠️ `key_snapshot_encrypted` هرگز نباید serialize شود. در `$hidden` است و هیچ
 * Resource ای آن را برنمی‌گرداند. تنها خواننده‌اش `ExamGrader` است.
 *
 * `question_id` **nullable** است چون Exam Builder شخصی می‌تواند سؤال ad-hoc
 * بسازد؛ ولی `render_snapshot` در هر حال اجباری است تا Attempt هرگز به دادهٔ
 * زندهٔ بانک سؤال وابسته نشود.
 */
class ExamQuestion extends Model
{
    use HasUuids;

    protected $table = 'exam_questions';

    /** @var list<string> */
    protected $fillable = [
        'exam_id', 'question_id', 'position', 'question_version',
        'render_snapshot', 'weight',
    ];

    /**
     * `key_snapshot_encrypted` عمداً در `$fillable` نیست: تنها `ExamSnapshotService`
     * با `forceFill` آن را می‌نویسد، و هیچ مسیر درخواستی به آن دسترسی ندارد.
     *
     * @var list<string>
     */
    protected $hidden = ['key_snapshot_encrypted'];

    /**
     * ⚠️ `key_snapshot_encrypted` عمداً cast `encrypted` لاراول ندارد.
     *
     * دلیل: Snapshot به‌صورت **درج دسته‌ای** نوشته می‌شود (یک دستور برای همهٔ
     * سؤال‌های آزمون) و درج دسته‌ای از cast مدل عبور نمی‌کند؛ پس اگر cast می‌بود،
     * مقدار آرایه‌ای مستقیم به دیتابیس می‌رفت و `Array to string conversion`
     * می‌داد. رمزنگاری صریح با `Crypt::encryptString` (همان APP_KEY، همان الگوریتم)
     * هم مسئله را حل می‌کند و هم نقطهٔ خواندن را صریح نگه می‌دارد.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'render_snapshot' => 'array',
            'position' => 'integer',
            'question_version' => 'integer',
            'weight' => 'float',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    /** @return HasMany<ExamAnswer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(ExamAnswer::class);
    }

    /**
     * شناسه‌های گزینه‌های مجاز این snapshot.
     *
     * @return list<string>
     */
    public function optionIds(): array
    {
        $options = $this->render_snapshot['options'] ?? [];

        return is_array($options)
            ? array_values(array_filter(array_map(
                static fn ($option) => is_array($option) ? ($option['id'] ?? null) : null,
                $options,
            )))
            : [];
    }

    /**
     * کلید پاسخ رمزگشایی‌شده — **تنها نقطهٔ رمزگشایی**.
     *
     * مصرف‌کننده‌ها: `ExamGrader` (تصحیح) و `ExamReviewResource` (فقط وقتی
     * `allow_review` روشن و نتیجه released است). هیچ Resource دیگری این متد را
     * صدا نمی‌زند و هیچ پاسخ HTTP ای `key_snapshot_encrypted` خام را برنمی‌گرداند.
     *
     * @return array{correct_option_id: string, key_version: int, explanation: mixed}|null
     */
    public function keySnapshot(): ?array
    {
        $raw = $this->key_snapshot_encrypted;

        if (! is_string($raw) || $raw === '') {
            return null;
        }

        try {
            $decoded = json_decode(Crypt::decryptString($raw), true);
        } catch (DecryptException) {
            /* کلید عوض شده یا رکورد دست‌کاری شده — تصحیح نباید بی‌صدا «درست»
               فرض کند؛ `null` یعنی «قابل تصحیح نیست» و Grader آن را غلط می‌شمارد. */
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }

    /** کلید پاسخ **درون snapshot** (شناسهٔ گزینه) یا null اگر کلید ثبت نشده باشد. */
    public function correctOptionId(): ?string
    {
        $id = $this->keySnapshot()['correct_option_id'] ?? null;

        return is_string($id) && $id !== '' ? $id : null;
    }
}
