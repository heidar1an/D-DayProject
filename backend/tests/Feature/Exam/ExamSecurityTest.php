<?php

namespace Tests\Feature\Exam;

use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamQuestion;
use App\Models\ExamResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * ماتریس امنیتی Exam Engine — فاز ۷.
 *
 * هر تست یک **سناریوی حملهٔ واقعی** را می‌بندد. اصل مشترک همه: مرز اعتماد
 * «کلاینت پیشنهاد می‌دهد، سرور تصمیم می‌گیرد». اگر روزی کسی فیلدی را به
 * `rules` یا `$fillable` اضافه کند و این مرز بشکند، اینجا سرخ می‌شود.
 *
 * پوشش: IDOR · تزریق نمره · تزریق زمان · تزریق فهرست سؤال · CSRF ·
 * Cross-Origin · مهمان · آزمون draft · دستکاری رتبه · سقف نرخ.
 */
class ExamSecurityTest extends TestCase
{
    use BuildsExams, BuildsQuestionBank, RefreshDatabase;

    // ── IDOR ────────────────────────────────────────────────────────────

    public function test_another_students_attempt_is_a_404_not_a_403(): void
    {
        $context = $this->openAttempt(2);

        /* دانش‌آموز دوم؛ از این لحظه کوکی‌های کلاینت متعلق به اوست. */
        $this->signedInStudent(['phone' => '09120000009']);

        /* ۴۰۴ و نه ۴۰۳: وجود Attempt کاربر دیگر نباید لو برود. */
        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        /* مالک واقعی همان Attempt را می‌بیند — یعنی ۴۰۴ از فیلتر مالکیت می‌آید. */
        $this->withAuthCookies($context['session']);
        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'])->assertOk();
    }

    public function test_another_student_cannot_write_answers_or_finish_someone_elses_attempt(): void
    {
        $context = $this->openAttempt(2);
        $question = $context['questions']->first();

        $intruder = $this->signedInStudent(['phone' => '09120000010']);

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $this->optionIdAt($question, 0),
            'revision' => 0,
        ], $intruder['csrf'])->assertStatus(404);

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $intruder['csrf'])
            ->assertStatus(404);

        /* هیچ ردیفی نباید ساخته شده باشد. */
        $this->assertSame(0, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    public function test_another_student_cannot_read_the_result_or_the_review(): void
    {
        $context = $this->openAttempt(2);

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $intruder = $this->signedInStudent(['phone' => '09120000011']);
        $this->withAuthCookies($intruder['session']);

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/result')->assertStatus(404);
        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/review')->assertStatus(404);
    }

    public function test_guests_are_rejected_on_every_attempt_route(): void
    {
        $context = $this->openAttempt(2);

        /* کوکی‌های سشن پاک می‌شوند ⇒ درخواست بعدی مهمان است. */
        $this->forgetCookies();

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'])
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $context['questions']->first()->getKey(),
            'selectedOptionId' => null,
            'revision' => 0,
        ], $context['csrf'])->assertStatus(401);

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])
            ->assertStatus(401);

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/result')->assertStatus(401);
        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/review')->assertStatus(401);
    }

    // ── تزریق از سمت کلاینت ─────────────────────────────────────────────

    public function test_the_client_cannot_inject_the_score(): void
    {
        $context = $this->openAttempt(2);

        /* هر دو سؤال عمداً غلط ⇒ نمرهٔ واقعی سرور صفر است. */
        foreach ($context['questions'] as $question) {
            $this->answerWrong($context, $question);
        }

        $finish = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [
            'score' => 100,
            'percentage' => 100,
            'maxScore' => 0,
            'correct_count' => 99,
            'correct' => 99,
            'wrong' => 0,
            'blank' => 0,
            'negativeMarking' => 0,
            'submit_reason' => 'grace',
            'status' => 'graded',
            'result' => ['percentage' => 100],
        ], $context['csrf'])->assertOk();

        $this->assertSame(0.0, (float) $finish->json('data.result.percentage'));
        $this->assertSame(0.0, (float) $finish->json('data.result.score'));
        $this->assertSame(0, $finish->json('data.result.correct_count'));
        $this->assertSame(2, $finish->json('data.result.wrong_count'));

        /* دلیل پایان هم از ساعت سرور می‌آید، نه از بدنه. */
        $this->assertSame(ExamAttempt::REASON_USER, $finish->json('data.attempt.submit_reason'));
    }

    public function test_the_client_cannot_inject_the_timing_or_the_status(): void
    {
        ['exam' => $exam] = $this->makeExam([
            'duration_minutes' => 30,
            'rules' => ['version' => 1, 'deadline_mode' => 'per_attempt'],
        ], 2);

        $student = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $student['csrf'])->assertStatus(201);

        $before = Carbon::now();

        $start = $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/attempts', [
            'startedAt' => Carbon::now()->subHours(5)->toIso8601String(),
            'started_at' => Carbon::now()->subHours(5)->toIso8601String(),
            'deadlineAt' => Carbon::now()->addDays(9)->toIso8601String(),
            'deadline_at' => Carbon::now()->addDays(9)->toIso8601String(),
            'submittedAt' => Carbon::now()->toIso8601String(),
            'attempt_no' => 42,
            'status' => ExamAttempt::STATUS_GRADED,
            'version' => 999,
        ], $student['csrf'])->assertStatus(201);

        $attemptId = $start->json('data.attempt.id');
        $attempt = ExamAttempt::query()->findOrFail($attemptId);

        $this->assertSame(1, (int) $attempt->attempt_no);
        $this->assertSame(ExamAttempt::STATUS_IN_PROGRESS, $attempt->status);
        $this->assertSame(1, (int) $attempt->version);
        $this->assertNull($attempt->submitted_at);

        /* شروع ≈ حالا (نه ۵ ساعت قبل) و مهلت = شروع + ۳۰ دقیقه (نه ۹ روز بعد). */
        $this->assertTrue($attempt->started_at->gte($before->copy()->subSecond()));
        $this->assertSame(
            $attempt->started_at->copy()->addMinutes(30)->timestamp,
            $attempt->deadline_at->timestamp,
        );
    }

    public function test_the_client_cannot_choose_which_questions_are_in_the_attempt(): void
    {
        $context = $this->openAttempt(3);

        $student = $this->signedInStudent(['phone' => '09120000012']);
        $this->postJsonWithOrigin('/api/v1/exams/'.$context['exam']->getKey().'/registrations', [], $student['csrf'])
            ->assertStatus(201);

        $start = $this->postJsonWithOrigin('/api/v1/exams/'.$context['exam']->getKey().'/attempts', [
            'questionIds' => [],
            'questions' => ['x'],
            'count' => 1,
        ], $student['csrf'])->assertStatus(201);

        /* فهرست سؤال‌ها از Snapshot آزمون می‌آید — نه از بدنهٔ درخواست. */
        $this->assertCount(3, $start->json('data.questions'));
    }

    public function test_an_option_from_another_exams_snapshot_is_rejected(): void
    {
        $context = $this->openAttempt(2);
        $question = $context['questions']->first();

        $other = $this->makeExam([], 2);
        $foreignOption = $this->optionIdAt($other['questions']->first(), 0);

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $foreignOption,
            'revision' => 0,
        ], $context['csrf'])
            ->assertStatus(422)
            ->assertJsonPath('error.fields.selectedOptionId.0', 'OPTION_NOT_IN_ATTEMPT');
    }

    public function test_a_finished_attempt_rejects_further_answers(): void
    {
        $context = $this->openAttempt(2);
        $question = $context['questions']->first();

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $this->optionIdAt($question, 0),
            'revision' => 0,
        ], $context['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ATTEMPT_CLOSED');
    }

    // ── CSRF و Origin ───────────────────────────────────────────────────

    public function test_a_write_without_a_csrf_token_is_rejected(): void
    {
        $context = $this->openAttempt(2);

        /* کوکی سشن هست، هدر CSRF نیست ⇒ double-submit نباید تطبیق کند. */
        $this->postJson('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], [
            'Origin' => $this->origin(),
        ])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'CSRF_FAILED');
    }

    public function test_a_cross_origin_write_is_rejected(): void
    {
        $context = $this->openAttempt(2);

        $this->postJson('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], [
            'Origin' => 'http://evil.example',
            ...$context['csrf'],
        ])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_a_write_without_any_origin_is_rejected(): void
    {
        $context = $this->openAttempt(2);

        $this->postJson('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    // ── آزمون منتشرنشده ────────────────────────────────────────────────

    public function test_a_draft_exam_is_neither_visible_nor_startable(): void
    {
        ['exam' => $exam] = $this->makeExam(['publish' => false], 2);

        $this->assertSame(Exam::STATUS_DRAFT, $exam->status);

        $this->getJson('/api/v1/exams/'.$exam->getKey())->assertStatus(404);
        $this->getJson('/api/v1/exams')->assertOk()->assertJsonMissing(['id' => $exam->getKey()]);

        $student = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/attempts', [], $student['csrf'])
            ->assertStatus(404);
    }

    public function test_an_exam_that_has_not_opened_yet_cannot_be_started(): void
    {
        ['exam' => $exam] = $this->makeExam([
            'opens_at' => Carbon::now()->addHours(2),
            'closes_at' => Carbon::now()->addHours(4),
        ], 2);

        $student = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $student['csrf'])->assertStatus(201);

        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/attempts', [], $student['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'EXAM_NOT_OPEN');
    }

    // ── رتبه ────────────────────────────────────────────────────────────

    public function test_the_ranking_cannot_be_manipulated_by_client_supplied_scores(): void
    {
        ['exam' => $exam, 'questions' => $questions] = $this->makeExam([], 2);

        /* شرکت‌کنندهٔ اول: صفر درست ⇒ نتیجهٔ ذخیره‌شده‌اش صفر است. */
        $first = $this->sitExam($exam, $questions, 0, ['phone' => '09120000021']);

        /* شرکت‌کنندهٔ دوم: واقعاً هر دو را درست می‌زند. */
        $this->sitExam($exam, $questions, 2, ['phone' => '09120000022']);

        $stored = ExamResult::query()->where('attempt_id', $first['attemptId'])->firstOrFail();

        $this->assertSame(0.0, (float) $stored->percentage);
        $this->assertSame(0, (int) $stored->correct_count);

        /* رتبهٔ شرکت‌کنندهٔ دوم (سشن فعال) = ۱ */
        $asSecond = $this->getJson('/api/v1/exams/'.$exam->getKey().'/ranking')->assertOk();
        $this->assertSame(2, $asSecond->json('data.ranking.participants_count'));
        $this->assertSame(1, $asSecond->json('data.ranking.me.rank'));

        /* و رتبهٔ شرکت‌کنندهٔ اول = ۲ — رتبه از نتیجهٔ واقعی می‌آید، نه از تزریق. */
        $this->withAuthCookies($first['session']);
        $asFirst = $this->getJson('/api/v1/exams/'.$exam->getKey().'/ranking')->assertOk();

        $this->assertSame(2, $asFirst->json('data.ranking.me.rank'));
        $this->assertSame(0.0, (float) $asFirst->json('data.ranking.me.percentage'));
        $this->assertSame(50.0, (float) $asSecond->json('data.ranking.average_percent'));
    }

    // ── سقف نرخ ─────────────────────────────────────────────────────────

    public function test_attempt_start_is_rate_limited(): void
    {
        ['exam' => $exam] = $this->makeAlwaysAvailableExam();
        $student = $this->signedInStudent();

        $max = (int) config('exam.rate_limits.attempt_start.max');

        /*
         * سقف Laravel در پنجرهٔ اول یک درخواست سخاوتمندانه‌تر است: `hit()` با
         * `add($key, 0)` شمارنده را صفر می‌سازد و شمارش از درخواست دوم شروع
         * می‌شود. پس روی «۱۲ تای موفق، بعد ۴۲۹» تأکید نمی‌کنیم؛ روی این تأکید
         * می‌کنیم که **قطعاً** مسدود می‌شود و تعداد عبور از سقف رد نمی‌شود.
         */
        $allowed = 0;
        $blocked = 0;
        $last = null;

        for ($request = 0; $request <= $max + 1; $request++) {
            $last = $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/attempts', [], $student['csrf']);

            if ($last->getStatusCode() === 429) {
                $blocked++;
            } else {
                $allowed++;
            }
        }

        $this->assertGreaterThan(0, $blocked, 'سقف نرخ باید فعال باشد.');
        $this->assertLessThanOrEqual($max + 1, $allowed, 'تعداد درخواست‌های مجاز از سقف رد شده است.');
        $this->assertSame(429, $last->getStatusCode());
        $this->assertSame('RATE_LIMITED', $last->json('error.code'));
    }

    // ── کمکی ────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $context */
    private function answerWrong(array $context, ExamQuestion $question): void
    {
        $options = $question->render_snapshot['options'];
        $wrong = ($this->correctOptionIndex($question) + 1) % count($options);

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $this->optionIdAt($question, $wrong),
            'revision' => 0,
        ], $context['csrf'])->assertOk();
    }
}
