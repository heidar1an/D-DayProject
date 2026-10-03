<?php

namespace App\Services\Analytics;

use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * دروازهٔ Analytics — فاز ۸.
 *
 * چرا یک لایهٔ نازک روی چهار سرویس: `user_id` در **همهٔ** مسیرها از سشن می‌آید
 * و کش per-user هم اینجا اعمال می‌شود. اگر هر سرویس خودش کش می‌کرد، احتمال
 * فراموش‌کردن `userId` در کلید و نشتی بین کاربران وجود داشت.
 *
 * اینجا هیچ محاسبه‌ای انجام نمی‌شود — فقط انتخاب سرویس، کش، و invalidate.
 */
class AnalyticsService
{
    public function __construct(
        private readonly OverviewAnalyticsService $overview,
        private readonly TopicAnalyticsService $topics,
        private readonly ExamAnalyticsService $exams,
        private readonly ProgressAnalyticsService $progress,
        private readonly AnalyticsCache $cache,
    ) {}

    /** @return array<string, mixed> */
    public function overview(User $user): array
    {
        return $this->cache->remember($user->getKey(), 'overview', fn (): array => $this->overview->build($user));
    }

    /** @return array<string, mixed> */
    public function topics(User $user): array
    {
        return $this->cache->remember($user->getKey(), 'topics', fn (): array => $this->topics->build($user));
    }

    /** @return array<string, mixed> */
    public function exams(User $user): array
    {
        return $this->cache->remember($user->getKey(), 'exams', fn (): array => $this->exams->build($user));
    }

    /**
     * @return array<string, mixed>
     */
    public function progress(User $user, string $bucket, string $timezone, ?CarbonInterface $from = null, ?CarbonInterface $to = null): array
    {
        $section = "progress:{$bucket}:{$timezone}:".($from?->format('Ymd') ?? '-').':'.($to?->format('Ymd') ?? '-');

        return $this->cache->remember(
            $user->getKey(),
            $section,
            fn (): array => $this->progress->build($user, $bucket, $timezone, $from, $to),
        );
    }

    /**
     * باطل‌کردن کش کاربر.
     *
     * صدا زده می‌شود از listener رویدادهای دامنه (Exam Finished / Progress Updated /
     * Study Session / Question Answered). invalidate فقط برای **همان** کاربر است؛
     * هیچ‌وقت کش کاربران دیگر دست نمی‌خورد.
     */
    public function invalidate(string $userId): void
    {
        $this->cache->invalidate($userId);
    }

    /** فقط برای تست/ابزار: بررسی این‌که محاسبه واقعاً انجام می‌شود (بدون کش). */
    public function freshOverview(User $user, ?CarbonInterface $now = null): array
    {
        return $this->overview->build($user, $now instanceof Carbon ? $now : null);
    }
}
