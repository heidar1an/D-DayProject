<?php

namespace App\Services\Exam;

use App\Models\Exam;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * فاز آزمون — **فقط از ساعت سرور** مشتق می‌شود (فاز ۷).
 *
 * این کلاس جانشین `examPhase()` در `database/examStore.js` است و همان برچسب‌های
 * `uiStatus` را برمی‌گرداند تا UI فعلی بدون تغییر بماند:
 *   UPCOMING · REGISTRATION_OPEN · REGISTRATION_CLOSED · LIVE · FINISHED ·
 *   RESULTS_AVAILABLE · AVAILABLE · CANCELLED
 *
 * تفاوت عمدی با legacy: legacy همه‌چیز را از زمان مشتق می‌کرد. اینجا ستون
 * `status` (چرخهٔ عمر ادمین) به‌عنوان **دروازهٔ محدودکننده** اضافه شده: می‌تواند
 * آزمون را ببندد یا آرشیو کند، ولی **هرگز نمی‌تواند آزمونی را زودتر از زمانش
 * باز کند**. `draft` هم اصلاً وارد API عمومی نمی‌شود.
 *
 * `phase` مرجع تصمیم امنیتی است؛ `uiStatus` فقط برچسب نمایشی.
 */
class ExamPhaseResolver
{
    public const PHASE_DRAFT = 'DRAFT';

    public const PHASE_ARCHIVED = 'ARCHIVED';

    public const PHASE_SCHEDULED = 'SCHEDULED';

    public const PHASE_LIVE = 'LIVE';

    public const PHASE_GRACE = 'GRACE';

    public const PHASE_FINISHED = 'FINISHED';

    public const PHASE_RESULTS = 'RESULTS';

    public const PHASE_AVAILABLE = 'AVAILABLE';

    /**
     * @return array{phase: string, uiStatus: string}
     */
    public function resolve(Exam $exam, ?CarbonInterface $now = null): array
    {
        $now = $now ?? Carbon::now();

        if ($exam->status === Exam::STATUS_ARCHIVED) {
            return ['phase' => self::PHASE_ARCHIVED, 'uiStatus' => 'FINISHED'];
        }

        if ($exam->status === Exam::STATUS_DRAFT) {
            return ['phase' => self::PHASE_DRAFT, 'uiStatus' => 'DRAFT'];
        }

        /* آزمون بدون پنجرهٔ زمانی = همیشه‌در‌دسترس (legacy: `alwaysAvailable`). */
        if ($exam->opens_at === null && $exam->closes_at === null) {
            return $exam->status === Exam::STATUS_CLOSED
                ? ['phase' => self::PHASE_FINISHED, 'uiStatus' => 'FINISHED']
                : ['phase' => self::PHASE_AVAILABLE, 'uiStatus' => 'AVAILABLE'];
        }

        if ($exam->opens_at !== null && $now->lt($exam->opens_at)) {
            return ['phase' => self::PHASE_SCHEDULED, 'uiStatus' => $this->registrationLabel($exam, $now)];
        }

        if ($exam->closes_at !== null && $now->gt($exam->closes_at)) {
            $graceUntil = $exam->closes_at->copy()->addSeconds((int) $exam->grace_seconds);

            if ($now->lte($graceUntil)) {
                /* پنجرهٔ گریس: فاز رسمی تمام است ولی submit هنوز باز است. */
                return ['phase' => self::PHASE_GRACE, 'uiStatus' => 'FINISHED'];
            }

            return $this->released($exam, $now)
                ? ['phase' => self::PHASE_RESULTS, 'uiStatus' => 'RESULTS_AVAILABLE']
                : ['phase' => self::PHASE_FINISHED, 'uiStatus' => 'FINISHED'];
        }

        if ($exam->status === Exam::STATUS_CLOSED) {
            return $this->released($exam, $now)
                ? ['phase' => self::PHASE_RESULTS, 'uiStatus' => 'RESULTS_AVAILABLE']
                : ['phase' => self::PHASE_FINISHED, 'uiStatus' => 'FINISHED'];
        }

        return ['phase' => self::PHASE_LIVE, 'uiStatus' => 'LIVE'];
    }

    /**
     * آیا نتیجهٔ آزمون قابل افشا است؟
     *
     * `result_release_at` تهی ⇒ انتشار فوری (همان `releaseGate` legacy). این
     * تصمیم **همیشه** سمت سرور گرفته می‌شود و در Resource ها دوباره چک می‌شود.
     */
    public function released(Exam $exam, ?CarbonInterface $now = null): bool
    {
        if ($exam->result_release_at === null) {
            return true;
        }

        return ($now ?? Carbon::now())->gte($exam->result_release_at);
    }

    /** آیا کاربر می‌تواند همین حالا Attempt بسازد؟ (بدون چک سهمیه/ثبت‌نام) */
    public function isOpenForAttempts(array $resolved): bool
    {
        return $resolved['phase'] === self::PHASE_LIVE || $resolved['phase'] === self::PHASE_AVAILABLE;
    }

    private function registrationLabel(Exam $exam, CarbonInterface $now): string
    {
        if ($exam->registration_opens_at !== null && $now->lt($exam->registration_opens_at)) {
            return 'UPCOMING';
        }

        if ($exam->registration_closes_at !== null && $now->gte($exam->registration_closes_at)) {
            return 'REGISTRATION_CLOSED';
        }

        return 'REGISTRATION_OPEN';
    }
}
