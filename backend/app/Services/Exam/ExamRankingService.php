<?php

namespace App\Services\Exam;

use App\Exceptions\ApiErrorException;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * رتبه‌بندی — فاز ۷.
 *
 * منبع: **فقط `exam_results` آزمون‌های released**. نه امتیاز کلاینت، نه
 * `analytics_events`، نه localStorage.
 *
 * تفاوت عمدی با legacy: `examStore.scoreDistribution()` وقتی شرکت‌کنندهٔ واقعی
 * کم بود، یک توزیع **مصنوعی** (mulberry32 seeded by examId) می‌ساخت تا دمو پر
 * به‌نظر برسد. آن رفتار اینجا بازتولید **نشده**: رتبه باید نتیجهٔ حقیقت آزمون
 * باشد، نه دادهٔ ساختگی. اگر شرکت‌کننده‌ای نباشد، رتبه‌بندی خالی است.
 *
 * حریم خصوصی: هیچ فهرست شرکت‌کننده‌ای افشا نمی‌شود. خروجی فقط تجمیع
 * (تعداد/میانگین/میانه/بیشینه) و رتبهٔ **خودِ کاربر** است. اگر UI روزی
 * leaderboard بخواهد، باید pseudonymized و صفحه‌بندی‌شده اضافه شود — نه اینجا.
 *
 * پیش از انتشار نتیجه، رتبه‌بندی وجود ندارد (۴۰۹): رتبه خودش بخشی از کارنامه است.
 */
class ExamRankingService
{
    public function __construct(
        private readonly ExamQueryService $exams,
        private readonly ExamPhaseResolver $phases,
    ) {}

    /** @return array<string, mixed> */
    public function ranking(?User $user, string $examIdOrSlug, ?CarbonInterface $now = null): array
    {
        $now = $now ?? Carbon::now();
        $exam = $this->exams->findVisible($examIdOrSlug);

        if (! $this->phases->released($exam, $now)) {
            throw new ApiErrorException('RESULT_NOT_RELEASED', 409, 'Results for this exam are not released yet.');
        }

        $aggregate = ExamResult::query()
            ->where('exam_id', $exam->getKey())
            ->selectRaw('count(*) as participants, coalesce(max(percentage), 0) as top, coalesce(avg(percentage), 0) as average')
            ->first();

        $participants = (int) ($aggregate->participants ?? 0);
        $top = (float) ($aggregate->top ?? 0);
        $average = $participants > 0 ? round((float) $aggregate->average, 1) : 0.0;

        $ranking = [
            'exam_id' => $exam->getKey(),
            'participants_count' => $participants,
            'top_percent' => (int) round($top),
            'median_percent' => (int) round($this->median($exam)),
            'average_percent' => $average,
            'me' => null,
        ];

        if ($user === null || $participants === 0) {
            return $ranking;
        }

        $mine = ExamResult::query()
            ->where('exam_id', $exam->getKey())
            ->where('user_id', $user->getKey())
            ->orderByDesc('graded_at')
            ->first();

        if ($mine === null) {
            return $ranking;
        }

        $better = ExamResult::query()
            ->where('exam_id', $exam->getKey())
            ->where('percentage', '>', $mine->percentage)
            ->count();

        $rank = $better + 1;

        $ranking['me'] = [
            'percentage' => (float) $mine->percentage,
            'rank' => $rank,
            'percentile' => max(0, (int) round((($participants - $rank) / $participants) * 100)),
        ];

        return $ranking;
    }

    /**
     * میانهٔ درصدها — با LIMIT/OFFSET، بدون کشیدن کل ستون به حافظه.
     *
     * میانهٔ آماری استاندارد: برای تعداد زوج، میانگین دو مقدار میانی.
     */
    private function median(Exam $exam): float
    {
        $count = ExamResult::query()->where('exam_id', $exam->getKey())->count();

        if ($count === 0) {
            return 0.0;
        }

        $lowerOffset = intdiv($count - 1, 2);

        $values = DB::table('exam_results')
            ->where('exam_id', $exam->getKey())
            ->orderBy('percentage')
            ->offset($lowerOffset)
            ->limit($count % 2 === 0 ? 2 : 1)
            ->pluck('percentage')
            ->map(static fn ($value): float => (float) $value)
            ->all();

        return array_sum($values) / max(count($values), 1);
    }
}
