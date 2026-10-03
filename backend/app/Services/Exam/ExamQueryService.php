<?php

namespace App\Services\Exam;

use App\Exceptions\ApiErrorException;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamRegistration;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * خواندن آزمون‌ها و محاسبهٔ وضعیت کاربر — فاز ۷.
 *
 * جانشین `listExamsFor`/`examDetailFor`/`computeUserState` در `examStore.js` با
 * همان معنای فیلدها تا UI فعلی بدون تغییر بماند.
 *
 * **بدون N+1:** برای فهرست، ثبت‌نام‌ها و Attempt های کاربر با دو Query دسته‌ای
 * خوانده می‌شوند، نه یکی‌به‌ازای‌هر‌آزمون.
 *
 * **بدون تصمیم امنیتی در کلاینت:** همهٔ فیلدهای `can_*` اینجا و از ساعت سرور و
 * ردیف‌های دیتابیس محاسبه می‌شوند. کلاینت فقط نمایش می‌دهد.
 */
class ExamQueryService
{
    public function __construct(private readonly ExamPhaseResolver $phases) {}

    /**
     * @param  array<string, mixed>  $filters  `kind`, `subject_id`, `status`
     * @return array{paginator: LengthAwarePaginator, states: array<string, array<string, mixed>>}
     */
    public function paginate(?User $user, array $filters, int $perPage, int $page): array
    {
        $query = Exam::query()
            ->publiclyVisible()
            ->with('subject:id,slug,title')
            ->orderByRaw('coalesce(opens_at, created_at) desc')
            ->orderBy('id');

        if (! empty($filters['kind'])) {
            $query->where('kind', $filters['kind']);
        }

        if (! empty($filters['subject_id'])) {
            $query->where('subject_id', $filters['subject_id']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return [
            'paginator' => $paginator,
            'states' => $this->statesFor($user, $paginator->getCollection()),
        ];
    }

    /** آزمون با UUID یا slug — فقط اگر عمومی باشد. */
    public function findVisible(string $idOrSlug): Exam
    {
        $query = Exam::query()->publiclyVisible()->with('subject:id,slug,title');

        if (Str::isUuid($idOrSlug)) {
            $query->where('id', $idOrSlug);
        } else {
            $query->where('slug', $idOrSlug);
        }

        $exam = $query->first();

        /* آزمون draft/archived هم ۴۰۴ می‌گیرد: وجود پیش‌نویس نباید لو برود. */
        if ($exam === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Exam not found.');
        }

        return $exam;
    }

    /** @return array<string, mixed> */
    public function stateFor(
        Exam $exam,
        ?CarbonInterface $registeredAt,
        Collection $attempts,
        ?CarbonInterface $now = null,
    ): array {
        $now = $now ?? Carbon::now();
        $resolved = $this->phases->resolve($exam, $now);
        $rules = ExamRules::fromArray(is_array($exam->rules) ? $exam->rules : []);

        $attemptsUsed = $attempts->count();
        $active = $attempts->firstWhere('status', ExamAttempt::STATUS_IN_PROGRESS);
        $lastFinished = $attempts->first(static fn (ExamAttempt $attempt): bool => $attempt->isFinished());

        $registrationOpen = $this->registrationIsOpen($exam, $now);
        $alwaysAvailable = $exam->opens_at === null && $exam->closes_at === null;
        $attemptLimit = (int) $exam->attempt_limit;

        $canStart = $resolved['phase'] === ExamPhaseResolver::PHASE_AVAILABLE
            ? $attemptsUsed < $attemptLimit
            : $resolved['phase'] === ExamPhaseResolver::PHASE_LIVE
                && ($registeredAt !== null || $exam->kind === Exam::KIND_QUIZ)
                && $attemptsUsed < $attemptLimit;

        $released = $this->phases->released($exam, $now);

        return [
            'status' => $resolved['uiStatus'],
            'phase' => $resolved['phase'],
            'registered' => $registeredAt !== null,
            'registered_at' => $registeredAt?->toIso8601String(),
            'can_register' => $registeredAt === null && ! $alwaysAvailable && $registrationOpen,
            'can_cancel_registration' => $registeredAt !== null && $registrationOpen,
            'attempts_used' => $attemptsUsed,
            'attempt_limit' => $attemptLimit,
            'can_start' => $canStart,
            'active_attempt_id' => $active?->getKey(),
            'last_attempt_id' => $lastFinished?->getKey(),
            'result_ready' => $released && $lastFinished !== null,
            'has_participated' => $attemptsUsed > 0,
        ];
    }

    /**
     * آیا پنجرهٔ ثبت‌نام باز است؟ — **تنها منبع تصمیم** برای ثبت‌نام.
     *
     * پنجرهٔ ثبت‌نام از پنجرهٔ برگزاری جداست (همان مدل `registrationOpenAt` /
     * `registrationDeadline` در legacy):
     *
     *   1. آزمون باید در وضعیت `scheduled` یا `open` باشد (`acceptsRegistrations`).
     *   2. اگر `registration_opens_at` ست شده، پیش از آن باز نیست.
     *   3. بستن: `registration_closes_at`؛ و اگر ست نشده باشد،
     *      `rules.late_registration = true` ⇒ تا `closes_at` باز می‌ماند،
     *      وگرنه با `opens_at` بسته می‌شود («باید پیش از شروع ثبت‌نام کنی»).
     *
     * نکتهٔ صداقتی: در legacy پرچم `lateRegistration` عملاً بی‌اثر بود، چون شرط
     * پنجرهٔ دیرهنگام خودش `now < registrationDeadline` داشت — یعنی همان شرط
     * پنجرهٔ عادی. اینجا تنها تفسیر معنادارش پیاده شده و در `docs/exam.md` ثبت است.
     */
    public function registrationIsOpen(Exam $exam, CarbonInterface $now): bool
    {
        if (! $exam->acceptsRegistrations()) {
            return false;
        }

        if ($exam->registration_opens_at !== null && $now->lt($exam->registration_opens_at)) {
            return false;
        }

        $rules = ExamRules::fromArray(is_array($exam->rules) ? $exam->rules : []);

        $closes = $exam->registration_closes_at
            ?? ($rules->allowsLateRegistration() ? $exam->closes_at : $exam->opens_at);

        return $closes === null || $now->lt($closes);
    }

    /**
     * @param  Collection<int, Exam>  $exams
     * @return array<string, array<string, mixed>>
     */
    public function statesFor(?User $user, Collection $exams): array
    {
        $now = Carbon::now();
        $examIds = $exams->pluck('id')->all();
        $userId = $user?->getKey();

        $registrations = $userId === null || $examIds === []
            ? collect()
            : ExamRegistration::query()
                ->where('user_id', $userId)
                ->whereIn('exam_id', $examIds)
                ->pluck('registered_at', 'exam_id');

        $attempts = $userId === null || $examIds === []
            ? collect()
            : ExamAttempt::query()
                ->where('user_id', $userId)
                ->whereIn('exam_id', $examIds)
                ->orderByDesc('started_at')
                ->get()
                ->groupBy('exam_id');

        $states = [];

        foreach ($exams as $exam) {
            $states[$exam->getKey()] = $this->stateFor(
                $exam,
                $registrations->get($exam->getKey()) !== null ? Carbon::parse($registrations->get($exam->getKey())) : null,
                $attempts->get($exam->getKey()) ?? collect(),
                $now,
            );
        }

        return $states;
    }
}
