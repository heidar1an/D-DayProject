<?php

namespace App\Services\Learning;

use App\Events\Learning\LessonCompleted;
use App\Events\Learning\ProgressUpdated;
use App\Exceptions\ApiErrorException;
use App\Models\LearningProgress;
use App\Models\LessonPage;
use App\Models\User;
use App\Services\Content\ContentVisibility;
use App\Services\Content\EntitlementGate;
use App\Services\Support\IdempotencyService;
use App\Support\Idempotency\IdempotencyOutcome;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * پیشرفت یادگیری — تنها نویسندهٔ `learning_progress`.
 *
 * قواعد کسب‌وکار (همه سمت سرور، هیچ‌کدام از کلاینت پذیرفته نمی‌شود):
 *   1. **مالکیت** از سشن می‌آید. `userId` در بدنه هیچ اثری ندارد.
 *   2. **قابلیت مشاهده** قبل از هر ثبت چک می‌شود: صفحه باید در زنجیرهٔ کامل
 *      منتشرشده باشد، وگرنه ۴۰۴ (نه ۴۰۳ — وجود پیش‌نویس نباید لو برود).
 *   3. **completion سرور-کنترل‌شده** است: فقط `completed=true` + صفحهٔ مجاز.
 *      `completed` چسبنده است و بدون reset صریح (که در این فاز نیست) برنمی‌گردد.
 *   4. **`secondsSpent` یک دلتا است**، نه مقدار مطلق. سقف هر درخواست در config
 *      است و سرویس هم مستقل clamp می‌کند (دفاع دولایه) ⇒ عدد بی‌نهایت نمی‌شود.
 *   5. **`lastPosition` یکنوا نیست** و فقط در بازهٔ مجاز clamp می‌شود.
 *   6. **optimistic lock**: `version` اجباری است. `0` یعنی «رکوردی وجود ندارد».
 *      عدم تطابق ⇒ ۴۰۹.
 *   7. **idempotency**: اگر کلاینت `Idempotency-Key` بفرستد، همان درخواست
 *      دوباره اجرا نمی‌شود و `seconds_spent` دو بار اضافه نمی‌شود.
 */
class ProgressService
{
    public function __construct(
        private readonly ContentVisibility $visibility,
        private readonly EntitlementGate $entitlement,
        private readonly IdempotencyService $idempotency,
    ) {}

    /** صفحهٔ مجاز برای این کاربر، یا ۴۰۴. */
    public function accessiblePage(string $pageId): LessonPage
    {
        $page = LessonPage::query()->where('id', $pageId)->with('lesson.chapter.course.subject')->first();

        if ($page === null || ! $this->visibility->pageIsVisible($page)) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Lesson page not found.');
        }

        return $page;
    }

    /** @return array{page: LessonPage, progress: ?LearningProgress} */
    public function show(User $user, string $pageId): array
    {
        $page = $this->accessiblePage($pageId);

        return [
            'page' => $page,
            'progress' => $this->find($user, $page),
        ];
    }

    /**
     * @param  array{version:int, lastPosition?:int|null, completed?:bool, secondsSpent?:int}  $data
     * @param  Closure(LearningProgress):array<string, mixed>  $present
     */
    public function update(User $user, string $pageId, array $data, ?string $requestKey, Closure $present): IdempotencyOutcome
    {
        $page = $this->accessiblePage($pageId);

        $this->assertEntitled($user, $page);

        return $this->idempotency->once(
            scope: 'learning.progress.update',
            actorKey: 'user:'.$user->getKey(),
            requestKey: $requestKey,
            requestPayload: [
                'lesson_page_id' => $page->getKey(),
                'version' => $data['version'],
                'last_position' => $data['lastPosition'] ?? null,
                'completed' => $data['completed'] ?? false,
                'seconds_spent' => $data['secondsSpent'] ?? 0,
            ],
            callback: fn (): IdempotencyOutcome => $this->apply($user, $page, $data, $present),
        );
    }

    /** خلاصهٔ پیشرفت کاربر — از رکوردهای منبع مشتق می‌شود، نه از مقدار ذخیره‌شده. */
    public function summary(User $user): array
    {
        $progress = DB::table('learning_progress')
            ->where('user_id', $user->getKey())
            ->selectRaw(
                'count(*) as tracked_pages, '
                .'sum(case when status = ? then 1 else 0 end) as completed_pages, '
                .'coalesce(sum(seconds_spent), 0) as seconds_spent',
                [LearningProgress::STATUS_COMPLETED],
            )
            ->first();

        $sessions = DB::table('study_sessions')
            ->where('user_id', $user->getKey())
            ->selectRaw('count(*) as total, coalesce(sum(duration_sec), 0) as seconds')
            ->first();

        return [
            'totals' => [
                'tracked_pages' => (int) ($progress->tracked_pages ?? 0),
                'completed_pages' => (int) ($progress->completed_pages ?? 0),
                'seconds_spent' => (int) ($progress->seconds_spent ?? 0),
                'study_sessions' => (int) ($sessions->total ?? 0),
                'study_seconds' => (int) ($sessions->seconds ?? 0),
            ],
            'courses' => $this->courseAggregates($user),
        ];
    }

    private function find(User $user, LessonPage $page): ?LearningProgress
    {
        return LearningProgress::query()
            ->where('user_id', $user->getKey())
            ->where('lesson_page_id', $page->getKey())
            ->first();
    }

    /** @param Closure(LearningProgress):array<string, mixed> $present */
    private function apply(User $user, LessonPage $page, array $data, Closure $present): IdempotencyOutcome
    {
        $result = DB::transaction(function () use ($user, $page, $data): LearningProgress {
            $progress = LearningProgress::query()
                ->where('user_id', $user->getKey())
                ->where('lesson_page_id', $page->getKey())
                ->lockForUpdate()
                ->first();

            $currentVersion = $progress?->version ?? 0;

            if ((int) $data['version'] !== $currentVersion) {
                throw new ApiErrorException(
                    'VERSION_CONFLICT',
                    409,
                    "Progress was modified by another request (current version: {$currentVersion}).",
                    ['version' => ['VERSION_CONFLICT']],
                );
            }

            $progress ??= $this->start($user, $page);

            $this->applySeconds($progress, (int) ($data['secondsSpent'] ?? 0));
            $this->applyPosition($progress, $data['lastPosition'] ?? null);
            $this->applyCompletion($progress, (bool) ($data['completed'] ?? false));

            $progress->forceFill(['version' => $currentVersion + 1])->save();

            return $progress;
        });

        $this->dispatchEvents($user, $page, $result);

        return new IdempotencyOutcome(false, 200, $present($result));
    }

    private function start(User $user, LessonPage $page): LearningProgress
    {
        $progress = new LearningProgress;
        $progress->forceFill([
            'user_id' => $user->getKey(),
            'lesson_page_id' => $page->getKey(),
            'status' => LearningProgress::STATUS_IN_PROGRESS,
            'seconds_spent' => 0,
            'version' => 1,
        ])->save();

        return $progress;
    }

    private function applySeconds(LearningProgress $progress, int $delta): void
    {
        if ($delta < 0) {
            throw ApiErrorException::invalid(['secondsSpent' => ['SECONDS_NEGATIVE']]);
        }

        // clamp دفاعی: اگر لایهٔ اعتبارسنجی روزی سست شود، اینجا عدد بی‌نهایت نمی‌شود.
        $delta = min($delta, (int) config('learning.progress.max_seconds_per_update'));

        $progress->seconds_spent = (int) $progress->seconds_spent + $delta;
    }

    private function applyPosition(LearningProgress $progress, ?int $position): void
    {
        if ($position === null) {
            return;
        }

        // عمداً یکنوا نیست: کاربر می‌تواند به صفحه/بخش قبلی برگردد.
        $progress->last_position = max(0, min($position, (int) config('learning.progress.max_position')));
    }

    private function applyCompletion(LearningProgress $progress, bool $completed): void
    {
        if ($completed) {
            if (! $progress->isCompleted()) {
                $progress->status = LearningProgress::STATUS_COMPLETED;
                $progress->completed_at = now();
            }

            return;
        }

        // چسبندگی: completed بدون reset صریح به عقب برنمی‌گردد.
        if (! $progress->isCompleted()) {
            $progress->status = LearningProgress::STATUS_IN_PROGRESS;
        }
    }

    private function assertEntitled(User $user, LessonPage $page): void
    {
        if (! $this->entitlement->allows($user, 'content.lesson_page', $page)) {
            throw new ApiErrorException('ENTITLEMENT_REQUIRED', 403, 'This content requires an active entitlement.');
        }
    }

    private function dispatchEvents(User $user, LessonPage $page, LearningProgress $progress): void
    {
        // رویدادها فقط شناسه و metadata حداقلی حمل می‌کنند — نه محتوای محرمانه.
        ProgressUpdated::dispatch($user->getKey(), $page->getKey(), $progress->status, $progress->version);

        if ($progress->isCompleted()) {
            LessonCompleted::dispatch($user->getKey(), $page->getKey(), $page->lesson_id);
        }
    }

    /** @return list<array<string, mixed>> */
    private function courseAggregates(User $user): array
    {
        $completed = LearningProgress::STATUS_COMPLETED;

        $mine = DB::table('learning_progress as lp')
            ->join('lesson_pages as pg', 'pg.id', '=', 'lp.lesson_page_id')
            ->join('lessons as l', 'l.id', '=', 'pg.lesson_id')
            ->join('chapters as ch', 'ch.id', '=', 'l.chapter_id')
            ->join('courses as c', 'c.id', '=', 'ch.course_id')
            ->join('subjects as s', 's.id', '=', 'c.subject_id')
            ->where('lp.user_id', $user->getKey())
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
         * مخرج کسر: صفحه‌های **قابل مشاهدهٔ** دوره — همان زنجیرهٔ کامل published.
         * اگر فقط وضعیت صفحه چک می‌شد، صفحهٔ published زیر درس draft در مخرج
         * می‌آمد و درصد هیچ‌وقت به ۱۰۰ نمی‌رسید.
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
}
