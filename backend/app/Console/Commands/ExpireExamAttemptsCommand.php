<?php

namespace App\Console\Commands;

use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Services\Exam\ExamAttemptService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * بستن Attempt های منقضی — فاز ۷.
 *
 * چرا لازم است با وجود انقضای تنبل: `ExamAttemptService::show()` فقط Attempt های
 * کاربری را می‌بندد که **برمی‌گردد**. Attempt ای که کاربر رهایش کرده تا ابد
 * `in_progress` می‌ماند و در «سهمیهٔ مصرف‌شده» و شمارش‌ها اثر می‌گذارد.
 *
 * این فرمان همان `sweepExpiredAttempts` legacy است، ولی:
 *   • **idempotent** — نهایی‌سازی روی Attempt بسته کوتاه می‌شود؛ اجرای دوباره
 *     نه نتیجهٔ تازه می‌سازد و نه نمره را دوباره محاسبه می‌کند.
 *   • **قابل‌کران** — `--limit` جلوی اجرای طولانی روی جدول بزرگ را می‌گیرد.
 *   • **`--dry-run`** — پیش از هر اجرای واقعی روی production.
 *
 * گریس: Attempt ای که مهلتش گذشته ولی هنوز در پنجرهٔ گریس است **بسته نمی‌شود**؛
 * کاربر هنوز می‌تواند submit کند.
 */
class ExpireExamAttemptsCommand extends Command
{
    protected $signature = 'exam:expire-attempts
        {--exam= : فقط Attempt های یک آزمون (UUID یا slug)}
        {--limit=500 : حداکثر تعداد Attempt در هر اجرا}
        {--dry-run : فقط گزارش کن، چیزی را تغییر نده}';

    protected $description = 'بستن Attempt های آزمونی که مهلتشان (به‌همراه گریس) گذشته است';

    public function handle(ExamAttemptService $attempts): int
    {
        $now = Carbon::now();
        $dryRun = (bool) $this->option('dry-run');
        $limit = max(1, (int) $this->option('limit'));

        $examId = null;

        if ($this->option('exam') !== null) {
            $needle = (string) $this->option('exam');

            /*
             * مقایسهٔ ستون `uuid` با یک رشتهٔ دلخواه روی PostgreSQL خطای
             * `22P02` می‌دهد (SQLite بی‌صدا صفر برمی‌گرداند) ⇒ فقط وقتی مقدار
             * واقعاً UUID است روی `id` شرط می‌گذاریم. همان الگوی
             * `ExamQueryService::findByIdOrSlug()`.
             */
            $exam = Exam::query()
                ->where(function ($query) use ($needle): void {
                    $query->where('slug', $needle);

                    if (Str::isUuid($needle)) {
                        $query->orWhere('id', $needle);
                    }
                })
                ->first();

            if ($exam === null) {
                $this->error('آزمون یافت نشد.');

                return self::FAILURE;
            }

            $examId = $exam->getKey();
        }

        /*
         * کاندیدها: مهلتشان گذشته (بدون گریس). چک گریس در PHP انجام می‌شود تا
         * جمع‌کردن تاریخ‌ها به dialect خاص SQL وابسته نشود.
         */
        $candidates = ExamAttempt::query()
            ->with('exam')
            ->where('status', ExamAttempt::STATUS_IN_PROGRESS)
            ->where('deadline_at', '<', $now)
            ->when($examId !== null, fn ($query) => $query->where('exam_id', $examId))
            ->orderBy('deadline_at')
            ->limit($limit)
            ->get();

        $expired = 0;
        $inGrace = 0;

        foreach ($candidates as $attempt) {
            $exam = $attempt->exam;

            if ($exam === null) {
                continue;
            }

            if ($attempt->submissionDeadline($exam)->gte($now)) {
                $inGrace++;

                continue;
            }

            if ($dryRun) {
                $this->line("· {$attempt->getKey()} — مهلت {$attempt->deadline_at?->toIso8601String()}");
                $expired++;

                continue;
            }

            $attempts->finalize($attempt, ExamAttempt::REASON_TIMEOUT, $now);
            $expired++;
        }

        $this->info(sprintf(
            '%s%d Attempt بسته شد · %d در پنجرهٔ گریس · %d کاندید بررسی شد.',
            $dryRun ? '[dry-run] ' : '',
            $expired,
            $inGrace,
            $candidates->count(),
        ));

        return self::SUCCESS;
    }
}
