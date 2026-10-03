<?php

namespace App\Services\Exam;

use App\Events\Exam\ExamFinished;
use App\Events\Exam\ExamStarted;
use App\Exceptions\ApiErrorException;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamQuestion;
use App\Models\ExamRegistration;
use App\Models\ExamResult;
use App\Models\User;
use App\Services\Support\IdempotencyService;
use App\Support\Idempotency\IdempotencyOutcome;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * موتور Attempt — فاز ۷.
 *
 * مرز اعتماد (همان اصل legacy، سخت‌گیرانه‌تر):
 *     کلاینت می‌گوید:   «گزینهٔ X را انتخاب کردم»
 *     سرور تعیین می‌کند: «X متعلق به این سؤال است؟»، «نمره چیست؟»،
 *                        «مهلت کی تمام می‌شود؟»، «آیا اجازهٔ تغییر داری؟»
 *
 * چه چیزی از کلاینت **پذیرفته نمی‌شود**: `score`, `isCorrect`, `correctAnswer`,
 * `negativeMarking`, `questionIds`, `duration`, `deadline`, `startedAt`,
 * `status`, `result`, `userId`. هیچ‌کدام در `rules` درخواست نیستند، پس به
 * `validated()` راه ندارند.
 *
 * همزمانی:
 *   • Start — `UNIQUE(exam_id,user_id,attempt_no)` + idempotency key؛ دو درخواست
 *     هم‌زمان یک Attempt می‌سازند و دومی همان را می‌گیرد.
 *   • Answer — `lockForUpdate` روی ردیف پاسخ + قفل خوش‌بینانهٔ `revision`.
 *   • Finish — `lockForUpdate` روی Attempt + `UNIQUE(attempt_id)` روی نتیجه؛
 *     دو finish هم‌زمان هرگز دو نتیجه نمی‌سازند.
 */
class ExamAttemptService
{
    public function __construct(
        private readonly ExamQueryService $exams,
        private readonly ExamPhaseResolver $phases,
        private readonly ExamGrader $grader,
        private readonly IdempotencyService $idempotency,
    ) {}

    /**
     * شروع (یا ادامهٔ) Attempt.
     *
     * @param  Closure(array{attempt: ExamAttempt, questions: Collection<int, ExamQuestion>, resumed: bool}):array<string, mixed>  $present
     */
    public function start(
        User $user,
        string $examIdOrSlug,
        ?string $requestKey,
        Closure $present,
        ?CarbonInterface $now = null,
    ): IdempotencyOutcome {
        $now = $now ?? Carbon::now();
        $exam = $this->exams->findVisible($examIdOrSlug);
        $this->expireStaleFor($exam, $user, $now);

        return $this->idempotency->once(
            scope: 'exam.attempt.start',
            actorKey: 'user:'.$user->getKey(),
            requestKey: $requestKey,
            requestPayload: ['exam_id' => $exam->getKey()],
            callback: fn (): IdempotencyOutcome => $this->createAttempt($exam, $user, $now, $present),
        );
    }

    /** @param Closure(array{attempt: ExamAttempt, questions: Collection<int, ExamQuestion>, resumed: bool}):array<string, mixed> $present */
    private function createAttempt(Exam $exam, User $user, CarbonInterface $now, Closure $present): IdempotencyOutcome
    {
        $resolved = $this->phases->resolve($exam, $now);

        if (! $this->phases->isOpenForAttempts($resolved)) {
            throw new ApiErrorException('EXAM_NOT_OPEN', 409, 'This exam is not open for attempts right now.');
        }

        $registered = ExamRegistration::query()
            ->where('exam_id', $exam->getKey())
            ->where('user_id', $user->getKey())
            ->exists();

        /* آزمونک بدون ثبت‌نام باز است (همان استثنای legacy: `exam.type === 'quiz'`). */
        if (! $registered && $exam->kind !== Exam::KIND_QUIZ && $resolved['phase'] === ExamPhaseResolver::PHASE_LIVE) {
            throw new ApiErrorException('NOT_REGISTERED', 409, 'You are not registered for this exam.');
        }

        $questions = ExamQuestion::query()
            ->where('exam_id', $exam->getKey())
            ->orderBy('position')
            ->get();

        if ($questions->isEmpty()) {
            throw new ApiErrorException('QUESTIONS_NOT_PUBLISHED', 409, 'This exam has no published questions.');
        }

        $existing = ExamAttempt::query()
            ->where('exam_id', $exam->getKey())
            ->where('user_id', $user->getKey())
            ->orderByDesc('started_at')
            ->get();

        $open = $existing->first(static fn (ExamAttempt $attempt): bool => $attempt->isOpen());

        /* دوبارکلیک/دو درخواست هم‌زمان: همان Attempt باز برگردانده می‌شود. */
        if ($open !== null) {
            return new IdempotencyOutcome(false, 200, $present(['attempt' => $open, 'questions' => $questions, 'resumed' => true]));
        }

        if ($existing->count() >= (int) $exam->attempt_limit) {
            throw new ApiErrorException('ATTEMPT_LIMIT_REACHED', 409, 'You have used all attempts for this exam.');
        }

        $deadline = $this->deadlineFor($exam, $now);

        $attempt = new ExamAttempt;
        $attempt->forceFill([
            'exam_id' => $exam->getKey(),
            'user_id' => $user->getKey(),
            'guest_id' => null,
            'attempt_no' => (int) $existing->max('attempt_no') + 1,
            'status' => ExamAttempt::STATUS_IN_PROGRESS,
            'version' => 1,
            'started_at' => $now,
            'deadline_at' => $deadline,
        ]);

        try {
            /*
             * در تراکنش خودش بسته می‌شود تا روی PostgreSQL شکستِ INSERT به
             * savepoint برگردد، نه به کل تراکنش (تلهٔ شناخته‌شدهٔ `25P02`).
             */
            DB::transaction(fn () => $attempt->save());
        } catch (UniqueConstraintViolationException) {
            $winner = ExamAttempt::query()
                ->where('exam_id', $exam->getKey())
                ->where('user_id', $user->getKey())
                ->where('status', ExamAttempt::STATUS_IN_PROGRESS)
                ->orderByDesc('started_at')
                ->first();

            if ($winner !== null) {
                return new IdempotencyOutcome(false, 200, $present(['attempt' => $winner, 'questions' => $questions, 'resumed' => true]));
            }

            throw new ApiErrorException('ATTEMPT_CONFLICT', 409, 'Another attempt is being created for this exam.');
        }

        ExamStarted::dispatch($exam->getKey(), $attempt->getKey(), $user->getKey(), $exam->kind);

        return new IdempotencyOutcome(false, 201, $present(['attempt' => $attempt, 'questions' => $questions, 'resumed' => false]));
    }

    /**
     * Attempt کاربر با چک مالکیت.
     *
     * عدم مالکیت ⇒ **۴۰۴** نه ۴۰۳: وجود Attempt کاربر دیگر نباید لو برود
     * (همان سیاست legacy `findAttempt`).
     */
    public function ownedAttempt(User $user, string $attemptId, bool $lock = false): ExamAttempt
    {
        $query = ExamAttempt::query()->where('id', $attemptId)->where('user_id', $user->getKey());

        if ($lock) {
            $query->lockForUpdate();
        }

        $attempt = $query->first();

        if ($attempt === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Exam attempt not found.');
        }

        return $attempt;
    }

    /**
     * نمایش Attempt — در صورت انقضای مهلت، همان‌جا نهایی می‌شود.
     *
     * @return array{attempt: ExamAttempt, questions: Collection<int, ExamQuestion>}
     */
    public function show(User $user, string $attemptId, ?CarbonInterface $now = null): array
    {
        $now = $now ?? Carbon::now();
        $attempt = $this->ownedAttempt($user, $attemptId);

        if ($attempt->isOpen() && $now->gt($attempt->submissionDeadline($attempt->exam))) {
            $attempt = $this->finalize($attempt, ExamAttempt::REASON_TIMEOUT, $now);
        }

        return ['attempt' => $attempt, 'questions' => $this->questionsOf($attempt)];
    }

    /**
     * ثبت/تغییر پاسخ — با قفل خوش‌بینانه و اعتبارسنجی تعلق گزینه به snapshot.
     *
     * @param  Closure(ExamAnswer):array<string, mixed>  $present
     */
    public function saveAnswer(
        User $user,
        string $attemptId,
        string $questionId,
        ?string $selectedOptionId,
        int $expectedRevision,
        ?int $timeSpent,
        Closure $present,
        ?CarbonInterface $now = null,
    ): array {
        $now = $now ?? Carbon::now();
        $attempt = $this->ownedAttempt($user, $attemptId);
        $exam = $attempt->exam;

        if (! $attempt->isOpen()) {
            throw new ApiErrorException('ATTEMPT_CLOSED', 409, 'This attempt is already finished.');
        }

        /* پاسخ بعد از مهلت پذیرفته نمی‌شود؛ گریس فقط برای finish است (قاعدهٔ legacy). */
        if ($now->gt($attempt->deadline_at)) {
            throw new ApiErrorException('TIME_OVER', 409, 'The attempt deadline has passed.');
        }

        $examQuestion = ExamQuestion::query()
            ->where('id', $questionId)
            ->where('exam_id', $exam->getKey())
            ->first();

        if ($examQuestion === null) {
            throw new ApiErrorException('QUESTION_NOT_IN_ATTEMPT', 403, 'This question does not belong to your attempt.');
        }

        if ($selectedOptionId !== null && ! in_array($selectedOptionId, $examQuestion->optionIds(), true)) {
            throw ApiErrorException::invalid(
                ['selectedOptionId' => ['OPTION_NOT_IN_ATTEMPT']],
                'The selected option does not belong to this exam question.',
            );
        }

        $rules = ExamRules::fromArray(is_array($exam->rules) ? $exam->rules : []);

        $answer = DB::transaction(function () use ($attempt, $examQuestion, $selectedOptionId, $expectedRevision, $timeSpent, $rules, $now): ExamAnswer {
            $existing = ExamAnswer::query()
                ->where('attempt_id', $attempt->getKey())
                ->where('exam_question_id', $examQuestion->getKey())
                ->lockForUpdate()
                ->first();

            $currentRevision = (int) ($existing?->revision ?? 0);

            if ($expectedRevision !== $currentRevision) {
                throw new ApiErrorException(
                    'REVISION_CONFLICT',
                    409,
                    "This answer was modified by another request (current revision: {$currentRevision}).",
                    ['revision' => ['REVISION_CONFLICT']],
                );
            }

            if ($existing !== null
                && ! $rules->allowsAnswerChange()
                && $existing->selected_option_id !== $selectedOptionId) {
                throw new ApiErrorException('ANSWER_CHANGE_NOT_ALLOWED', 409, 'Changing an answer is not allowed in this exam.');
            }

            $answer = $existing ?? new ExamAnswer;
            $answer->forceFill([
                'attempt_id' => $attempt->getKey(),
                'exam_question_id' => $examQuestion->getKey(),
                'selected_option_id' => $selectedOptionId,
                'revision' => $currentRevision + 1,
                'time_spent_sec' => $timeSpent === null ? null : max(0, min($timeSpent, 24 * 3600)),
                /* زمان پاسخ از ساعت سرور؛ `answeredAt` کلاینت خوانده نمی‌شود. */
                'answered_at' => $now,
            ])->save();

            return $answer;
        });

        return $present($answer);
    }

    /**
     * پایان Attempt — تصحیح و صدور نتیجه در **یک تراکنش** با قفل ردیف.
     *
     * idempotent: فراخوانی دوباره همان نتیجه را برمی‌گرداند و نمرهٔ تازه‌ای
     * محاسبه نمی‌شود (`finalize` روی Attempt بسته کوتاه می‌شود).
     *
     * @param  Closure(array{attempt: ExamAttempt, result: ExamResult}):array<string, mixed>  $present
     */
    public function finish(
        User $user,
        string $attemptId,
        ?string $requestKey,
        Closure $present,
        ?CarbonInterface $now = null,
    ): IdempotencyOutcome {
        $now = $now ?? Carbon::now();
        $attempt = $this->ownedAttempt($user, $attemptId);

        return $this->idempotency->once(
            scope: 'exam.attempt.finish',
            actorKey: 'user:'.$user->getKey(),
            requestKey: $requestKey,
            requestPayload: ['attempt_id' => $attempt->getKey()],
            callback: function () use ($attempt, $now, $present, $requestKey): IdempotencyOutcome {
                /* مالکیت یک‌بار در بالای متد چک شد؛ اینجا فقط تازه‌سازی وضعیت. */
                $fresh = ExamAttempt::query()->whereKey($attempt->getKey())->firstOrFail();

                if (! $fresh->isOpen()) {
                    /* پایان تکراری ⇒ همان نتیجه، بدون تصحیح دوباره. */
                    return new IdempotencyOutcome(false, 200, $present([
                        'attempt' => $fresh,
                        'result' => $fresh->result,
                        'idempotent' => true,
                    ]));
                }

                $reason = $now->gt($fresh->deadline_at) ? ExamAttempt::REASON_GRACE : ExamAttempt::REASON_USER;
                $finished = $this->finalize($fresh, $reason, $now, $requestKey);

                return new IdempotencyOutcome(false, 200, $present([
                    'attempt' => $finished,
                    'result' => $finished->result,
                    'idempotent' => false,
                ]));
            },
        );
    }

    /**
     * نهایی‌سازی Attempt — **تنها نقطهٔ گذار** `in_progress → graded|expired`.
     *
     * قفل ردیف + بررسی وضعیت داخل تراکنش یعنی دو finish هم‌زمان فقط یکی نتیجه
     * می‌سازد. `UNIQUE(attempt_id)` روی `exam_results` لایهٔ دوم دفاع است.
     */
    public function finalize(ExamAttempt $attempt, string $reason, CarbonInterface $now, ?string $submitKey = null): ExamAttempt
    {
        $exam = $attempt->exam;
        $timedOut = $reason === ExamAttempt::REASON_TIMEOUT;

        $locked = DB::transaction(function () use ($attempt, $exam, $reason, $now, $submitKey, $timedOut): ExamAttempt {
            $locked = ExamAttempt::query()->whereKey($attempt->getKey())->lockForUpdate()->first();

            if ($locked === null || ! $locked->isOpen()) {
                return $locked ?? $attempt;
            }

            $questions = ExamQuestion::query()
                ->where('exam_id', $exam->getKey())
                ->orderBy('position')
                ->get();

            $answers = ExamAnswer::query()->where('attempt_id', $locked->getKey())->get();

            $graded = $this->grader->grade($exam, $locked, $questions, $answers);

            $result = new ExamResult;
            $result->forceFill($graded + [
                'attempt_id' => $locked->getKey(),
                'exam_id' => $exam->getKey(),
                'user_id' => $locked->user_id,
                'submit_reason' => $timedOut ? ExamAttempt::REASON_TIMEOUT : $reason,
                'graded_at' => $now,
            ])->save();

            $locked->forceFill([
                'status' => $timedOut ? ExamAttempt::STATUS_EXPIRED : ExamAttempt::STATUS_GRADED,
                'submit_reason' => $timedOut ? ExamAttempt::REASON_TIMEOUT : $reason,
                'submitted_at' => $timedOut ? $locked->deadline_at : $now,
                'graded_at' => $now,
                'submit_key' => $submitKey,
                'version' => (int) $locked->version + 1,
            ])->save();

            return $locked;
        });

        $attempt->refresh();

        /* رویداد فقط بعد از commit — Analytics نباید نتیجهٔ نانهایی‌شده را بخواند. */
        $this->dispatchFinished($attempt);

        return $attempt;
    }

    /** @return Collection<int, ExamQuestion> */
    public function questionsOf(ExamAttempt $attempt): Collection
    {
        return ExamQuestion::query()
            ->where('exam_id', $attempt->exam_id)
            ->orderBy('position')
            ->get();
    }

    /**
     * انقضای تنبل: Attempt های باز کاربر که مهلتشان گذشته، همین‌جا نهایی می‌شوند.
     *
     * چرا تنبل و نه فقط زمان‌بند: سرور تک‌منبع حقیقت زمان است؛ حتی اگر هیچ
     * زمان‌بندی اجرا نشود، اولین خواندن کاربر نتیجهٔ درست را می‌بیند. برای
     * بستن Attempt هایی که کاربر هرگز برنمی‌گردد، فرمان `exam:expire-attempts`
     * وجود دارد (اجرای زمان‌بندی‌شده خارج از این فاز است).
     */
    public function expireStaleFor(Exam $exam, User $user, ?CarbonInterface $now = null): int
    {
        $now = $now ?? Carbon::now();

        $stale = ExamAttempt::query()
            ->where('exam_id', $exam->getKey())
            ->where('user_id', $user->getKey())
            ->where('status', ExamAttempt::STATUS_IN_PROGRESS)
            ->where('deadline_at', '<', $now->copy()->subSeconds((int) $exam->grace_seconds))
            ->get();

        foreach ($stale as $attempt) {
            $this->finalize($attempt, ExamAttempt::REASON_TIMEOUT, $now);
        }

        return $stale->count();
    }

    private function deadlineFor(Exam $exam, CarbonInterface $now): CarbonInterface
    {
        $rules = ExamRules::fromArray(is_array($exam->rules) ? $exam->rules : []);
        $minutes = (int) ($exam->duration_minutes ?? 0);

        if ($rules->perAttemptDeadline() && $minutes > 0) {
            return $now->copy()->addMinutes($minutes);
        }

        if ($exam->closes_at !== null) {
            return $exam->closes_at->copy();
        }

        return $now->copy()->addMinutes(max($minutes, 1));
    }

    private function dispatchFinished(ExamAttempt $attempt): void
    {
        if ($attempt->user_id === null || ! $attempt->isFinished()) {
            return;
        }

        $result = ExamResult::query()->where('attempt_id', $attempt->getKey())->first();

        if ($result === null) {
            return;
        }

        ExamFinished::dispatch(
            $attempt->exam_id,
            $attempt->getKey(),
            $attempt->user_id,
            $attempt->status,
            (string) $attempt->submit_reason,
            $result->getKey(),
        );
    }
}
