<?php

namespace App\Services\Analytics;

use App\Models\LearningProgress;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * پیشرفت و روند زمانی — فاز ۸.
 *
 * منبع پیشرفت: `learning_progress` (منبع حقیقت تکمیل صفحه).
 * منبع زمان مطالعه: `study_sessions`.
 *
 * **Timezone:** دیتابیس همیشه UTC است. تجمیع زمانی با timezone **تعریف‌شده**
 * انجام می‌شود — از پارامتر `tz` درخواست (اعتبارسنجی‌شده با فهرست رسمی PHP) و
 * در نبود آن از `config('app.timezone')`. هیچ `Asia/Tehran` یا `UTC` در کد
 * hardcode نشده؛ مرز روزها از ساعت سرور و تنظیم واقعی کاربر می‌آید.
 *
 * **دانه‌بندی:** `daily` | `weekly` | `monthly`. سطل‌بندی در PHP انجام می‌شود تا
 * SQL بین SQLite (تست) و PostgreSQL (production) یکسان بماند — با فیلتر
 * `(user_id, started_at)` که از ایندکس موجود استفاده می‌کند.
 */
class ProgressAnalyticsService
{
    /** @return array<string, mixed> */
    public function build(User $user, string $bucket, string $timezone, ?CarbonInterface $from = null, ?CarbonInterface $to = null): array
    {
        $to = $to ?? Carbon::now();
        $from = $from ?? $to->copy()->subDays(30);
        $userId = $user->getKey();

        return [
            'courses' => $this->courseProgress($userId),
            'subjects' => $this->subjectProgress($userId),
            'totals' => $this->totals($userId),
            'trend' => $this->trend($userId, $bucket, $timezone, $from, $to),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function courseProgress(string $userId): array
    {
        $completed = LearningProgress::STATUS_COMPLETED;

        $mine = DB::table('learning_progress as lp')
            ->join('lesson_pages as pg', 'pg.id', '=', 'lp.lesson_page_id')
            ->join('lessons as l', 'l.id', '=', 'pg.lesson_id')
            ->join('chapters as ch', 'ch.id', '=', 'l.chapter_id')
            ->join('courses as c', 'c.id', '=', 'ch.course_id')
            ->join('subjects as s', 's.id', '=', 'c.subject_id')
            ->where('lp.user_id', $userId)
            ->groupBy('c.id', 'c.slug', 'c.title', 's.slug', 's.title')
            ->selectRaw(
                'c.id as course_id, c.slug as course_slug, c.title as course_title, '
                .'s.slug as subject_slug, s.title as subject_title, '
                .'count(*) as tracked_pages, '
                .'sum(case when lp.status = ? then 1 else 0 end) as completed_pages, '
                .'coalesce(sum(lp.seconds_spent), 0) as seconds_spent',
                [$completed],
            )
            ->get();

        if ($mine->isEmpty()) {
            return [];
        }

        /*
         * مخرج کسر: صفحه‌های **قابل مشاهدهٔ** دوره (زنجیرهٔ کامل published).
         * اگر فقط وضعیت خود صفحه چک می‌شد، صفحهٔ published زیر درس draft در مخرج
         * می‌آمد و درصد هیچ‌وقت به ۱۰۰ نمی‌رسید. همان قاعدهٔ `ProgressService`.
         */
        $totals = DB::table('lesson_pages as pg')
            ->join('lessons as l', 'l.id', '=', 'pg.lesson_id')
            ->join('chapters as ch', 'ch.id', '=', 'l.chapter_id')
            ->join('courses as c', 'c.id', '=', 'ch.course_id')
            ->join('subjects as s', 's.id', '=', 'c.subject_id')
            ->where('pg.status', 'published')
            ->where('l.status', 'published')
            ->where('ch.status', 'published')
            ->where('c.status', 'published')
            ->where('s.status', 'published')
            ->groupBy('c.id')
            ->selectRaw('c.id as course_id, count(*) as total_pages')
            ->pluck('total_pages', 'course_id');

        return $mine->map(function ($row) use ($totals): array {
            $total = (int) ($totals[$row->course_id] ?? 0);

            return [
                'course_id' => $row->course_id,
                'course_slug' => $row->course_slug,
                'course_title' => $row->course_title,
                'subject_slug' => $row->subject_slug,
                'subject_title' => $row->subject_title,
                'tracked_pages' => (int) $row->tracked_pages,
                'completed_pages' => (int) $row->completed_pages,
                'total_pages' => $total,
                'percent' => $total > 0 ? (int) round(($row->completed_pages / $total) * 100) : 0,
                'seconds_spent' => (int) $row->seconds_spent,
            ];
        })->values()->all();
    }

    /** @return list<array<string, mixed>> */
    private function subjectProgress(string $userId): array
    {
        $completed = LearningProgress::STATUS_COMPLETED;

        $rows = DB::table('learning_progress as lp')
            ->join('lesson_pages as pg', 'pg.id', '=', 'lp.lesson_page_id')
            ->join('lessons as l', 'l.id', '=', 'pg.lesson_id')
            ->join('chapters as ch', 'ch.id', '=', 'l.chapter_id')
            ->join('courses as c', 'c.id', '=', 'ch.course_id')
            ->join('subjects as s', 's.id', '=', 'c.subject_id')
            ->where('lp.user_id', $userId)
            ->groupBy('s.id', 's.slug', 's.title')
            ->selectRaw(
                's.id as subject_id, s.slug as subject_slug, s.title as subject_title, '
                .'count(*) as tracked_pages, '
                .'sum(case when lp.status = ? then 1 else 0 end) as completed_pages, '
                .'coalesce(sum(lp.seconds_spent), 0) as seconds_spent',
                [$completed],
            )
            ->orderByDesc('completed_pages')
            ->get();

        return $rows->map(static fn ($row): array => [
            'subject_id' => $row->subject_id,
            'subject_slug' => $row->subject_slug,
            'subject_title' => $row->subject_title,
            'tracked_pages' => (int) $row->tracked_pages,
            'completed_pages' => (int) $row->completed_pages,
            'seconds_spent' => (int) $row->seconds_spent,
        ])->all();
    }

    /** @return array<string, int> */
    private function totals(string $userId): array
    {
        $progress = DB::table('learning_progress')
            ->where('user_id', $userId)
            ->selectRaw(
                'count(*) as tracked_pages, '
                .'sum(case when status = ? then 1 else 0 end) as completed_pages, '
                .'coalesce(sum(seconds_spent), 0) as reading_seconds',
                [LearningProgress::STATUS_COMPLETED],
            )
            ->first();

        $lessons = DB::table('learning_progress as lp')
            ->join('lesson_pages as pg', 'pg.id', '=', 'lp.lesson_page_id')
            ->where('lp.user_id', $userId)
            ->where('lp.status', LearningProgress::STATUS_COMPLETED)
            ->distinct()
            ->count('pg.lesson_id');

        $sessions = DB::table('study_sessions')
            ->where('user_id', $userId)
            ->selectRaw('count(*) as total, coalesce(sum(coalesce(duration_sec, 0)), 0) as seconds')
            ->first();

        return [
            'tracked_pages' => (int) ($progress->tracked_pages ?? 0),
            'completed_pages' => (int) ($progress->completed_pages ?? 0),
            'completed_lessons' => $lessons,
            'reading_seconds' => (int) ($progress->reading_seconds ?? 0),
            'study_sessions' => (int) ($sessions->total ?? 0),
            'study_seconds' => (int) ($sessions->seconds ?? 0),
        ];
    }

    /**
     * روند زمانی — سطل‌بندی در PHP با timezone درخواستی.
     *
     * @return list<array<string, mixed>>
     */
    private function trend(string $userId, string $bucket, string $timezone, CarbonInterface $from, CarbonInterface $to): array
    {
        $maxBuckets = (int) config('analytics.limits.max_trend_buckets');

        $sessions = DB::table('study_sessions')
            ->where('user_id', $userId)
            ->whereBetween('started_at', [$from->copy()->utc(), $to->copy()->utc()])
            ->get(['started_at', 'duration_sec']);

        $pages = DB::table('learning_progress')
            ->where('user_id', $userId)
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from->copy()->utc(), $to->copy()->utc()])
            ->get(['completed_at']);

        $buckets = [];

        foreach ($sessions as $session) {
            $key = $this->bucketKey(Carbon::parse($session->started_at)->setTimezone($timezone), $bucket);
            $buckets[$key] ??= ['bucket' => $key, 'study_seconds' => 0, 'completed_pages' => 0];
            $buckets[$key]['study_seconds'] += (int) ($session->duration_sec ?? 0);
        }

        foreach ($pages as $page) {
            $key = $this->bucketKey(Carbon::parse($page->completed_at)->setTimezone($timezone), $bucket);
            $buckets[$key] ??= ['bucket' => $key, 'study_seconds' => 0, 'completed_pages' => 0];
            $buckets[$key]['completed_pages']++;
        }

        ksort($buckets);

        return array_slice(array_values($buckets), -$maxBuckets);
    }

    private function bucketKey(Carbon $moment, string $bucket): string
    {
        return match ($bucket) {
            'monthly' => $moment->format('Y-m'),
            'weekly' => $moment->format('o-\WW'),
            default => $moment->format('Y-m-d'),
        };
    }
}
