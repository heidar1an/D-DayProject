<?php

namespace App\Services\GreenPath;

use App\Events\GreenPath\GreenPathStepCompleted;
use App\Exceptions\ApiErrorException;
use App\Models\Exam;
use App\Models\ExamResult;
use App\Models\GreenPath;
use App\Models\GreenPathStep;
    use App\Models\LearningProgress;
    use App\Models\Lesson;
    use App\Models\User;
use App\Services\Support\IdempotencyService;
use App\Support\Idempotency\IdempotencyOutcome;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * موتور مسیر سبز — تنها نویسندهٔ `green_paths` / `green_path_steps` (فاز ۱۳).
 *
 * مرزها:
 *   • مسیر سبز مالک «برنامه» است، نه پیشرفت واقعی. تکمیل قدم‌های محتوایی
 *     (lesson/question/exam) فقط از رخداد واقعی یادگیری انجام می‌شود و کلاینت
 *     هرگز نمی‌تواند آن‌ها را completed کند.
 *   • «امروز» و هر محاسبهٔ تاریخ، با ساعت سرور است — ورودی کلاینت فقط
 *     بازهٔ تقویم (from/to) است که اعتبارسنجی و کراندار می‌شود.
 *   • Rebuild انقضای تنبل دارد: اگر مجموعهٔ محتوای واقعی از زمان تولید برنامه
 *     عوض شده باشد (اثر انگشت محتوا)، همان لحظهٔ خواندن، برنامه نسخهٔ تازه
 *     می‌گیرد — قدم‌های completed با `completed_at` واقعی carry-over می‌شوند
 *     و هیچ‌چیز حذف فیزیکی نمی‌شود (مسیر قبلی archived می‌ماند).
 */
class GreenPathService
{
    public function __construct(
        private readonly IdempotencyService $idempotency,
    ) {}

    /* ────────────────────────────── خواندن‌ها ────────────────────────────── */

    /** پروفایل موردنیاز مسیر سبز — فقط از دادهٔ واقعی کاربر. */
    public function profile(User $user): array
    {
        $profile = DB::table('user_profiles as p')
            ->leftJoin('universities as u', 'u.id', '=', 'p.university_id')
            ->where('p.user_id', $user->getKey())
            ->selectRaw('p.username, p.first_name, p.last_name, p.grade, p.term, u.name as university_name')
            ->first();

        $path = $this->ensureActivePath($user);
        $horizonWeeks = max(1, (int) config('green_path.planning.horizon_weeks'));
        $start = $path->starts_at ?? $path->created_at ?? Carbon::now();

        return [
            'user_id' => $user->getKey(),
            'username' => $profile->username ?? null,
            'first_name' => $profile->first_name ?? null,
            'last_name' => $profile->last_name ?? null,
            'university' => $profile->university_name ?? null,
            'grade' => $profile->grade ?? null,
            'term' => $profile->term ?? null,
            'goal_key' => $path->goal_key,
            'plan_version' => (int) $path->plan_version,
            'plan_start' => $start->toIso8601String(),
            'plan_end' => $start->copy()->addWeeks($horizonWeeks)->toIso8601String(),
        ];
    }

    /** Roadmap کامل — با کش کوتاه‌مدت per-user. */
    public function roadmap(User $user): array
    {
        $path = $this->ensureActivePath($user);

        return Cache::remember(
            $this->roadmapCacheKey($user),
            (int) config('green_path.cache.roadmap_ttl_seconds'),
            fn (): array => $this->buildRoadmap($path),
        );
    }

    /** قدم‌های امروز + عقب‌افتاده‌ها. */
    public function today(User $user): array
    {
        $path = $this->ensureActivePath($user);
        $now = Carbon::now();
        $startOfDay = $now->copy()->startOfDay();
        $endOfDay = $now->copy()->endOfDay();

        $steps = $path->steps()->get();

        $dueToday = $steps->filter(
            fn (GreenPathStep $step) => $step->due_at !== null
                && $step->due_at->between($startOfDay, $endOfDay),
        )->values();

        $overdue = $steps->filter(
            fn (GreenPathStep $step) => ! $step->completionIsDerived()
                || $step->status !== GreenPathStep::STATUS_COMPLETED,
        )
            ->filter(fn (GreenPathStep $step) => $step->due_at !== null && $step->due_at->lt($startOfDay))
            ->filter(fn (GreenPathStep $step) => $step->status !== GreenPathStep::STATUS_COMPLETED)
            ->take(20)
            ->values();

        return [
            'date' => $now->toDateString(),
            'path_id' => $path->getKey(),
            'steps' => $dueToday->map(fn (GreenPathStep $step) => $this->presentStep($step))->all(),
            'overdue' => $overdue->map(fn (GreenPathStep $step) => $this->presentStep($step))->all(),
            'progress' => $this->progressSummary($steps),
        ];
    }

    /** تقویم برنامه در بازهٔ بستهٔ [from, to] — کراندار و ایندکس‌پذیر. */
    public function calendar(User $user, CarbonInterface $from, CarbonInterface $to): array
    {
        $path = $this->ensureActivePath($user);

        $steps = $path->steps()
            ->whereNotNull('due_at')
            ->where('due_at', '>=', $from->copy()->startOfDay())
            ->where('due_at', '<=', $to->copy()->endOfDay())
            ->orderBy('due_at')
            ->get();

        $days = [];

        foreach ($steps as $step) {
            $key = $step->due_at->toDateString();
            $days[$key] ??= ['date' => $key, 'steps' => [], 'planned_minutes' => 0];
            $days[$key]['steps'][] = $this->presentStep($step);
            $days[$key]['planned_minutes'] += $step->kind === GreenPathStep::KIND_LESSON
                ? (int) config('green_path.planning.minutes_per_lesson_step')
                : 0;
        }

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'days' => array_values($days),
        ];
    }

    /** عملکرد واقعی کاربر در مسیر — همهٔ اعداد از جداول منبع. */
    public function performance(User $user): array
    {
        $path = $this->ensureActivePath($user);
        $steps = $path->steps()->get();
        $now = Carbon::now();

        $completed = $steps->where('status', GreenPathStep::STATUS_COMPLETED)->count();
        $total = $steps->count();
        $overdue = $steps
            ->where('status', '!=', GreenPathStep::STATUS_COMPLETED)
            ->where('due_at', '<', $now)
            ->count();

        $study = DB::table('study_sessions')
            ->where('user_id', $user->getKey())
            ->selectRaw('count(*) as sessions, coalesce(sum(duration_sec), 0) as seconds')
            ->first();

        $exams = DB::table('exam_results')
            ->where('user_id', $user->getKey())
            ->selectRaw('count(*) as taken, coalesce(avg(percentage), 0) as avg_percentage')
            ->first();

        $trend = DB::table('green_path_steps')
            ->where('path_id', $path->getKey())
            ->whereNotNull('completed_at')
            ->where('completed_at', '>=', $now->copy()->subDays(13)->startOfDay())
            ->selectRaw('date(completed_at) as day, count(*) as completed')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->map(fn ($row): array => ['date' => (string) $row->day, 'completed' => (int) $row->completed])
            ->all();

        return [
            'steps' => [
                'total' => $total,
                'completed' => $completed,
                'overdue' => $overdue,
                'completion_rate' => $total > 0 ? (int) round(($completed / $total) * 100) : 0,
            ],
            'study_time' => [
                'sessions' => (int) ($study->sessions ?? 0),
                'seconds' => (int) ($study->seconds ?? 0),
            ],
            'exams' => [
                'taken' => (int) ($exams->taken ?? 0),
                'avg_percentage' => (int) round((float) ($exams->avg_percentage ?? 0)),
            ],
            'trend' => $trend,
        ];
    }

    /* ───────────────────────────── تغییر وضعیت ───────────────────────────── */

    /**
     * گذار وضعیت قدم از درخواست کاربر — تنها دو گذار مجاز است و تکمیل قدم‌های
     * محتوایی هرگز از این مسیر ممکن نیست.
     *
     * @param  array{status:string, version:int}  $data
     * @param  Closure(GreenPathStep):array<string, mixed>  $present
     */
    public function updateStep(User $user, string $stepId, array $data, ?string $requestKey, Closure $present): IdempotencyOutcome
    {
        return $this->idempotency->once(
            scope: 'greenpath.step.update',
            actorKey: 'user:'.$user->getKey(),
            requestKey: $requestKey,
            requestPayload: [
                'step_id' => $stepId,
                'status' => $data['status'],
                'version' => $data['version'],
            ],
            callback: fn (): IdempotencyOutcome => $this->applyStepUpdate($user, $stepId, $data, $present),
        );
    }

    /** @param Closure(GreenPathStep):array<string, mixed> $present */
    private function applyStepUpdate(User $user, string $stepId, array $data, Closure $present): IdempotencyOutcome
    {
        $step = DB::transaction(function () use ($user, $stepId, $data): GreenPathStep {
            $step = GreenPathStep::query()
                ->where('id', $stepId)
                ->whereHas('path', fn ($query) => $query->where('user_id', $user->getKey())->where('status', GreenPath::STATUS_ACTIVE))
                ->lockForUpdate()
                ->first();

            /* مالکیت با ۴۰۴ پاس داده می‌شود — وجود قدمِ دیگری لو نمی‌رود. */
            if ($step === null) {
                throw new ApiErrorException('NOT_FOUND', 404, 'Green path step not found.');
            }

            if ((int) $data['version'] !== (int) $step->version) {
                throw new ApiErrorException(
                    'VERSION_CONFLICT',
                    409,
                    "Step was modified by another request (current version: {$step->version}).",
                    ['version' => ['VERSION_CONFLICT']],
                );
            }

            $allowed = GreenPathStep::userTransitions()[$step->status] ?? [];

            if (! in_array($data['status'], $allowed, true)) {
                throw new ApiErrorException(
                    'INVALID_TRANSITION',
                    409,
                    "Transition {$step->status} → {$data['status']} is not permitted.",
                    ['status' => ['INVALID_TRANSITION']],
                );
            }

            if ($data['status'] === GreenPathStep::STATUS_COMPLETED && $step->completionIsDerived()) {
                throw new ApiErrorException(
                    'INVALID_TRANSITION',
                    409,
                    'Completion of content steps is derived from real learning activity.',
                    ['status' => ['INVALID_TRANSITION']],
                );
            }

            /* CHECK دیتابیس: completed بدون completed_at نامعتبر است — یکجا نوشته می‌شود. */
            $step->forceFill([
                'status' => $data['status'],
                'version' => (int) $step->version + 1,
                'completed_at' => $data['status'] === GreenPathStep::STATUS_COMPLETED ? Carbon::now() : null,
            ])->save();

            $path = $step->path()->firstOrFail();
            $this->recomputeStepStates($path, $path->steps()->get());

            return $step->refresh();
        });

        Cache::forget($this->roadmapCacheKey($user));

        if ($step->status === GreenPathStep::STATUS_COMPLETED) {
            GreenPathStepCompleted::dispatch($user->getKey(), $step->getKey(), $step->kind);
        }

        return new IdempotencyOutcome(false, 200, $present($step));
    }

    /* ─────────────────────────────── موتور ─────────────────────────────── */

    /** مسیر فعال کاربر — یا موجود، یا تازه‌ساخته. انقضای تنبل fingerprint. */
    public function ensureActivePath(User $user): GreenPath
    {
        $path = GreenPath::query()
            ->where('user_id', $user->getKey())
            ->where('status', GreenPath::STATUS_ACTIVE)
            ->first();

        if ($path === null) {
            return $this->generatePath($user, 1);
        }

        if ($this->contentFingerprint() !== $path->content_fingerprint) {
            return $this->rebuild($user);
        }

        return $path;
    }

    /**
     * Rebuild: مسیر فعال archive می‌شود و نسخهٔ تازه ساخته می‌شود. قدم‌های
     * lesson/exam از دادهٔ واقعی دوباره مشتق می‌شوند (completed_at واقعی حفظ)،
     * و قدم‌های action تکمیل‌شده با `carry_over` منتقل می‌شوند. هیچ رکوردی
     * حذف نمی‌شود.
     */
    public function rebuild(User $user): GreenPath
    {
        return DB::transaction(function () use ($user): GreenPath {
            $current = GreenPath::query()
                ->where('user_id', $user->getKey())
                ->where('status', GreenPath::STATUS_ACTIVE)
                ->lockForUpdate()
                ->first();

            $nextVersion = $current === null ? 1 : (int) $current->plan_version + 1;

            /* ترتیب مهم است: ابتدا archive تا unique «یک مسیر فعال» نقض نشود. */
            if ($current !== null) {
                $current->forceFill(['status' => GreenPath::STATUS_ARCHIVED])->save();
            }

            $path = $this->generatePath($user, $nextVersion);

            if ($current !== null) {
                $this->carryOverCompletedActionSteps($current, $path);
            }

            Cache::forget($this->roadmapCacheKey($user));

            return $path;
        });
    }

    /** قدم‌های action تکمیل‌شدهٔ مسیر قبلی به نسخهٔ تازه منتقل می‌شوند. */
    private function carryOverCompletedActionSteps(GreenPath $old, GreenPath $new): void
    {
        $completed = $old->steps()
            ->where('kind', GreenPathStep::KIND_ACTION)
            ->where('status', GreenPathStep::STATUS_COMPLETED)
            ->orderBy('position')
            ->get();

        $position = (int) $new->steps()->max('position');

        foreach ($completed as $step) {
            $position++;

            (new GreenPathStep)->forceFill([
                'path_id' => $new->getKey(),
                'kind' => GreenPathStep::KIND_ACTION,
                'lesson_id' => null,
                'question_id' => null,
                'exam_id' => null,
                'position' => $position,
                'status' => GreenPathStep::STATUS_COMPLETED,
                'due_at' => $step->due_at,
                'completed_at' => $step->completed_at,
                'source' => GreenPathStep::SOURCE_CARRY_OVER,
                'version' => 1,
            ])->save();
        }
    }

    /**
     * تکمیل قدم‌های درسی وقتی همهٔ صفحه‌های درس واقعاً completed شده‌اند.
     * از رخداد `LessonCompleted` (گذار completed یک صفحه) صدا زده می‌شود.
     */
    public function completeLessonSteps(string $userId, string $lessonId): int
    {
        return $this->completeDerivedSteps(
            $userId,
            GreenPathStep::KIND_LESSON,
            'lesson_id',
            $lessonId,
            fn (): bool => $this->lessonFullyCompleted($userId, $lessonId),
        );
    }

    /** تکمیل قدم‌های آزمون پس از نتیجهٔ واقعی (`ExamFinished`). */
    public function completeExamSteps(string $userId, string $examId): int
    {
        return $this->completeDerivedSteps($userId, GreenPathStep::KIND_EXAM, 'exam_id', $examId, fn (): bool => true);
    }

    /** تکمیل قدم‌های سؤال پس از پاسخ درست واقعی (`QuestionAnswered`). */
    public function completeQuestionSteps(string $userId, string $questionId): int
    {
        return $this->completeDerivedSteps($userId, GreenPathStep::KIND_QUESTION, 'question_id', $questionId, fn (): bool => true);
    }

    /**
     * @param  callable():bool  $guard
     */
    private function completeDerivedSteps(string $userId, string $kind, string $column, string $targetId, callable $guard): int
    {
        if (! $guard()) {
            return 0;
        }

        $completed = DB::transaction(function () use ($userId, $kind, $column, $targetId): array {
            $path = GreenPath::query()
                ->where('user_id', $userId)
                ->where('status', GreenPath::STATUS_ACTIVE)
                ->lockForUpdate()
                ->first();

            if ($path === null) {
                return [];
            }

            $steps = GreenPathStep::query()
                ->where('path_id', $path->getKey())
                ->where('kind', $kind)
                ->where($column, $targetId)
                ->where('status', '!=', GreenPathStep::STATUS_COMPLETED)
                ->lockForUpdate()
                ->get();

            foreach ($steps as $step) {
                $step->forceFill([
                    'status' => GreenPathStep::STATUS_COMPLETED,
                    'completed_at' => Carbon::now(),
                    'version' => (int) $step->version + 1,
                ])->save();
            }
            if ($steps->isNotEmpty()) {
                $this->recomputeStepStates($path, $path->steps()->get());
            }

            return $steps->all();
        });

        if ($completed === []) {
            return 0;
        }

        $user = User::query()->find($userId);
        if ($user !== null) {
            Cache::forget($this->roadmapCacheKey($user));
        }

        foreach ($completed as $step) {
            GreenPathStepCompleted::dispatch($userId, $step->getKey(), $step->kind);
        }

        return count($completed);
    }

    /* ─────────────────────────── تولید برنامه ─────────────────────────── */

    private function generatePath(User $user, int $planVersion): GreenPath
    {
        $now = Carbon::now();
        $fingerPrint = $this->contentFingerprint();

        $path = new GreenPath;
        $path->forceFill([
            'user_id' => $user->getKey(),
            'semester_id' => null, // تا وقتی ترم واقعیِ کاربر در پروژه اتصال ندارد، null معنادار است.
            'goal_key' => (string) config('green_path.goals.default'),
            'plan_version' => $planVersion,
            'status' => GreenPath::STATUS_ACTIVE,
            'starts_at' => $now,
            'content_fingerprint' => $fingerPrint,
        ])->save();

        $specs = $this->planSpecs($user, $now);
        $position = 0;

        foreach ($specs as $spec) {
            $position++;

            /* $fillable عمداً خالی است — ساخت فقط با forceFill. */
            (new GreenPathStep)->forceFill([
                ...$spec,
                'path_id' => $path->getKey(),
                'position' => $position,
            ])->save();
        }

        $this->recomputeStepStates($path, $path->steps()->get());

        return $path->refresh();
    }

    /**
     * برنامۀ خام از دادهٔ واقعی: درس‌های منتشرشده + آزمون‌های برنامه‌ریزی‌شده.
     * هیچ قدم مصنوعی/تزئینی ساخته نمی‌شود؛ قدم‌هایی که کاربر واقعاً تکمیل
     * کرده، از همان ابتدا completed و با زمان واقعی می‌آیند.
     *
     * @return list<array<string, mixed>>
     */
    private function planSpecs(User $user, CarbonInterface $now): array
    {
        $maxSteps = max(1, (int) config('green_path.planning.max_steps'));

        $lessons = Lesson::query()
            ->join('chapters as ch', 'ch.id', '=', 'lessons.chapter_id')
            ->join('courses as c', 'c.id', '=', 'ch.course_id')
            ->join('subjects as s', 's.id', '=', 'c.subject_id')
            ->where('lessons.status', 'published')
            ->where('ch.status', 'published')
            ->where('c.status', 'published')
            ->where('s.status', 'published')
            ->orderBy('s.sort_order')
            ->orderBy('c.sort_order')
            ->orderBy('ch.sort_order')
            ->orderBy('lessons.sort_order')
            ->orderBy('lessons.id')
            ->select('lessons.*')
            ->get();

        $completedPageAt = DB::table('lesson_pages')
            ->join('learning_progress as lp', function ($join) use ($user): void {
                $join->on('lp.lesson_page_id', '=', 'lesson_pages.id')
                    ->where('lp.user_id', $user->getKey())
                    ->where('lp.status', LearningProgress::STATUS_COMPLETED);
            })
            ->join('lessons as l', 'l.id', '=', 'lesson_pages.lesson_id')
            ->groupBy('l.id')
            ->selectRaw('l.id as lesson_id, count(*) as completed_pages')
            ->pluck('completed_pages', 'lesson_id');

        $totalPages = DB::table('lesson_pages')
            ->groupBy('lesson_id')
            ->selectRaw('lesson_id, count(*) as total')
            ->pluck('total', 'lesson_id');

        $exams = Exam::query()
            ->whereIn('status', [Exam::STATUS_SCHEDULED, Exam::STATUS_OPEN])
            ->whereNotNull('opens_at')
            ->orderBy('opens_at')
            ->get();

        $examResults = ExamResult::query()
            ->where('user_id', $user->getKey())
            ->pluck('graded_at', 'exam_id');

        $cursor = $now->copy();
        $minutesPerLesson = max(1, (int) config('green_path.planning.minutes_per_lesson_step'));
        $dailyCapacity = max($minutesPerLesson, (int) config('green_path.planning.daily_minutes'));
        $capacityLeft = $dailyCapacity;

        $specs = [];

        $advanceCursor = function () use (&$cursor, &$capacityLeft, $dailyCapacity, $minutesPerLesson): void {
            $capacityLeft -= $minutesPerLesson;

            if ($capacityLeft < 0) {
                $cursor = $cursor->copy()->addDay()->startOfDay()->setTime(18, 0);
                $capacityLeft = $dailyCapacity - $minutesPerLesson;
            }
        };

        foreach ($lessons as $lesson) {
            if (count($specs) >= $maxSteps) {
                break;
            }

            $lessonId = (string) $lesson->getKey();
            $done = (int) ($completedPageAt[$lessonId] ?? 0);
            $total = (int) ($totalPages[$lessonId] ?? 0);

            if ($total > 0 && $done >= $total) {
                /* درس واقعاً تکمیل شده — قدمش همان اول completed است، نه ادعای UI. */
                $completedAt = DB::table('learning_progress as lp')
                    ->join('lesson_pages as pg', 'pg.id', '=', 'lp.lesson_page_id')
                    ->where('pg.lesson_id', $lessonId)
                    ->where('lp.user_id', $user->getKey())
                    ->where('lp.status', LearningProgress::STATUS_COMPLETED)
                    ->max('lp.completed_at');

                $specs[] = [
                    'kind' => GreenPathStep::KIND_LESSON,
                    'lesson_id' => $lessonId,
                    'question_id' => null,
                    'exam_id' => null,
                    'status' => GreenPathStep::STATUS_COMPLETED,
                    'due_at' => $completedAt !== null ? Carbon::parse($completedAt) : $now,
                    'completed_at' => $completedAt !== null ? Carbon::parse($completedAt) : $now,
                    'source' => GreenPathStep::SOURCE_PLAN,
                ];

                continue;
            }

            $specs[] = [
                'kind' => GreenPathStep::KIND_LESSON,
                'lesson_id' => $lessonId,
                'question_id' => null,
                'exam_id' => null,
                'status' => GreenPathStep::STATUS_AVAILABLE,
                'due_at' => $cursor->copy(),
                'completed_at' => null,
                'source' => GreenPathStep::SOURCE_PLAN,
            ];

            $advanceCursor();
        }

        foreach ($exams as $exam) {
            if (count($specs) >= $maxSteps) {
                break;
            }

            $examId = (string) $exam->getKey();
            $gradedAt = $examResults[$examId] ?? null;

            $specs[] = [
                'kind' => GreenPathStep::KIND_EXAM,
                'lesson_id' => null,
                'question_id' => null,
                'exam_id' => $examId,
                'status' => $gradedAt !== null ? GreenPathStep::STATUS_COMPLETED : GreenPathStep::STATUS_AVAILABLE,
                'due_at' => Carbon::parse($exam->opens_at),
                'completed_at' => $gradedAt !== null ? Carbon::parse($gradedAt) : null,
                'source' => GreenPathStep::SOURCE_PLAN,
            ];
        }

        return $specs;
    }

    /**
     * اثر انگشت مجموعهٔ محتوای مؤثر بر برنامه — کلید rebuild تنبل.
     */
    private function contentFingerprint(): string
    {
        $lessonIds = Lesson::query()
            ->join('chapters as ch', 'ch.id', '=', 'lessons.chapter_id')
            ->join('courses as c', 'c.id', '=', 'ch.course_id')
            ->join('subjects as s', 's.id', '=', 'c.subject_id')
            ->where('lessons.status', 'published')
            ->where('ch.status', 'published')
            ->where('c.status', 'published')
            ->where('s.status', 'published')
            ->orderBy('lessons.id')
            ->pluck('lessons.id');

        $examIds = Exam::query()            ->whereIn('status', [Exam::STATUS_SCHEDULED, Exam::STATUS_OPEN])
            ->whereNotNull('opens_at')
            ->orderBy('id')
            ->pluck('id');

        return hash('sha256', 'lessons:'.implode('', $lessonIds->all()).'|exams:'.implode('', $examIds->all()).'|goal:'.(string) config('green_path.goals.default'));
    }

    /**
     * قیود وضعیت‌ها بعد از هر تغییر:
     *   • اولین قدم ناتمام = `recommended` (مگر in_progress باشد).
     *   • (window-1) قدم بعدی = `available`؛ بقیه = `locked`.
     *   • قدم‌های آزمونی نزدیکِ موعد همیشه `available` می‌مانند.
     */
    /**
     * @param  iterable<int, GreenPathStep>  $steps
     */
    private function recomputeStepStates(GreenPath $path, iterable $steps): void
    {
        $window = max(1, (int) config('green_path.planning.unlock_window'));
        $examDays = max(0, (int) config('green_path.planning.exam_available_days'));
        $now = Carbon::now();

        $pending = $steps
            ->filter(fn (GreenPathStep $step) => $step->status !== GreenPathStep::STATUS_COMPLETED)
            ->sortBy('position')
            ->values();

        if ($pending->isEmpty()) {
            return;
        }

        $openCount = 0;

        foreach ($pending as $index => $step) {
            $nearExam = $step->kind === GreenPathStep::KIND_EXAM
                && $step->due_at !== null
                && $step->due_at->lte($now->copy()->addDays($examDays));

            if ($openCount === 0) {
                /* قلم پیش‌رو: recommended، مگر کاربر خودش در حال انجامش باشد. */
                $next = $step->status === GreenPathStep::STATUS_IN_PROGRESS
                    ? GreenPathStep::STATUS_IN_PROGRESS
                    : GreenPathStep::STATUS_RECOMMENDED;
            } elseif ($openCount < $window || $nearExam) {
                $next = GreenPathStep::STATUS_AVAILABLE;
            } else {
                $next = $step->status === GreenPathStep::STATUS_IN_PROGRESS
                    ? GreenPathStep::STATUS_IN_PROGRESS
                    : GreenPathStep::STATUS_LOCKED;
            }

            $openCount++;

            if ($step->status !== $next) {
                $step->forceFill(['status' => $next])->save();
            }
        }
    }

    private function lessonFullyCompleted(string $userId, string $lessonId): bool
    {
        $total = DB::table('lesson_pages')->where('lesson_id', $lessonId)->count();

        if ($total === 0) {
            return false;
        }

        $completed = DB::table('learning_progress as lp')
            ->join('lesson_pages as pg', 'pg.id', '=', 'lp.lesson_page_id')
            ->where('pg.lesson_id', $lessonId)
            ->where('lp.user_id', $userId)
            ->where('lp.status', LearningProgress::STATUS_COMPLETED)
            ->count();

        return $completed >= $total;
    }

    /**
     * @param  $steps  iterable<int, GreenPathStep>
     * @return array<string, mixed>
     */
    private function progressSummary($steps): array
    {
        $total = $steps->count();
        $completed = $steps->where('status', GreenPathStep::STATUS_COMPLETED)->count();

        return [
            'total_steps' => $total,
            'completed_steps' => $completed,
            'percent' => $total > 0 ? (int) round(($completed / $total) * 100) : 0,
        ];
    }

    private function buildRoadmap(GreenPath $path): array
    {
        $steps = $path->steps()->get();
        $pending = $steps->filter(fn (GreenPathStep $s) => $s->status !== GreenPathStep::STATUS_COMPLETED)->sortBy('position')->values();

        $current = $pending->first();
        $next = $pending->get(1);

        return [
            'path' => [
                'id' => $path->getKey(),
                'goal_key' => $path->goal_key,
                'plan_version' => (int) $path->plan_version,
                'status' => $path->status,
                'starts_at' => $path->starts_at?->toIso8601String(),
            ],
            'steps' => $steps->map(fn (GreenPathStep $step) => $this->presentStep($step))->all(),
            'current_step' => $current !== null ? $this->presentStep($current) : null,
            'next_step' => $next !== null ? $this->presentStep($next) : null,
            'progress' => $this->progressSummary($steps),
            'meta' => [
                'plan_version' => (int) $path->plan_version,
                'goal_key' => $path->goal_key,
                'generated_at' => $path->updated_at?->toIso8601String(),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function presentStep(GreenPathStep $step): array
    {
        return [
            'id' => $step->getKey(),
            'kind' => $step->kind,
            'target' => match (true) {
                $step->lesson_id !== null => ['type' => 'lesson', 'id' => $step->lesson_id],
                $step->question_id !== null => ['type' => 'question', 'id' => $step->question_id],
                $step->exam_id !== null => ['type' => 'exam', 'id' => $step->exam_id],
                default => null,
            },
            'position' => (int) $step->position,
            'status' => $step->status,
            'due_at' => $step->due_at?->toIso8601String(),
            'completed_at' => $step->completed_at?->toIso8601String(),
            'version' => (int) $step->version,
        ];
    }

    private function roadmapCacheKey(User $user): string
    {
        return 'green-path:'.$user->getKey().':roadmap';
    }
}
