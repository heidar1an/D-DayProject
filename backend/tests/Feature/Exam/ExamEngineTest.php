<?php

namespace Tests\Feature\Exam;

use App\Exceptions\ApiErrorException;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamRegistration;
use App\Models\ExamResult;
use App\Services\Exam\ExamService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * موتور آزمون — سناریوهای سرتاسری فاز ۷.
 *
 * هر تست مسیر واقعی HTTP را می‌رود و در پایان روی **دادهٔ ذخیره‌شده** تأیید
 * می‌کند. اگر جایی بین Request → Service → Grader → Resource ناهم‌خوانی باشد،
 * اینجا دیده می‌شود.
 */
class ExamEngineTest extends TestCase
{
    use BuildsExams, BuildsQuestionBank, RefreshDatabase;

    // ── ساخت و چرخهٔ عمر ────────────────────────────────────────────────

    public function test_an_exam_is_created_as_draft_and_published_with_a_snapshot(): void
    {
        ['exam' => $exam, 'questions' => $questions] = $this->makeExam(['title' => 'آزمون جامع'], 4);

        $this->assertSame(Exam::STATUS_OPEN, $exam->status);
        $this->assertNotNull($exam->published_at);
        $this->assertCount(4, $questions);
        $this->assertSame(4, $exam->question_count);
        $this->assertSame([1, 2, 3, 4], $questions->pluck('position')->all());
    }

    public function test_an_exam_without_questions_cannot_be_published(): void
    {
        $service = app(ExamService::class);
        $exam = $service->create(['slug' => 'empty-exam', 'kind' => Exam::KIND_QUIZ, 'title' => 'خالی'], []);

        $this->expectException(ApiErrorException::class);

        $service->publish($exam);
    }

    public function test_invalid_status_transition_is_rejected(): void
    {
        ['exam' => $exam] = $this->makeExam();
        $service = app(ExamService::class);

        $service->transitionStatus($exam, Exam::STATUS_CLOSED);

        /* `closed → open` گذار مجاز نیست. */
        $this->expectException(ApiErrorException::class);

        $service->transitionStatus($exam->refresh(), Exam::STATUS_OPEN);
    }

    public function test_draft_exams_are_invisible_publicly(): void
    {
        ['exam' => $exam] = $this->makeExam(['publish' => false]);

        $this->getJson('/api/v1/exams')->assertOk();
        $this->assertNotContains($exam->getKey(), array_column($this->getJson('/api/v1/exams')->json('data.exams'), 'id'));

        /* شناسهٔ مستقیم هم ۴۰۴ می‌گیرد — وجود پیش‌نویس نباید لو برود. */
        $this->getJson('/api/v1/exams/'.$exam->getKey())->assertStatus(404);
    }

    public function test_exam_detail_returns_server_time_and_user_state(): void
    {
        ['exam' => $exam] = $this->makeExam();

        $response = $this->getJson('/api/v1/exams/'.$exam->slug)->assertOk();

        $response->assertJsonPath('data.exam.id', $exam->getKey());
        $response->assertJsonPath('data.exam.user_state.registered', false);
        $response->assertJsonPath('data.exam.user_state.attempts_used', 0);
        $this->assertNotEmpty($response->json('data.server_time'));
    }

    // ── ثبت‌نام ─────────────────────────────────────────────────────────

    public function test_a_student_can_register_and_the_registration_is_idempotent(): void
    {
        ['exam' => $exam] = $this->makeExam(['status' => Exam::STATUS_OPEN]);
        ['csrf' => $csrf, 'user' => $user] = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $csrf)->assertStatus(201);

        /* ثبت‌نام دوباره خطا نیست و رکورد تکراری نمی‌سازد. */
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $csrf)->assertStatus(201);

        $this->assertSame(1, ExamRegistration::query()->where('exam_id', $exam->getKey())->where('user_id', $user->getKey())->count());
    }

    public function test_registration_is_rejected_when_the_exam_is_closed(): void
    {
        ['exam' => $exam] = $this->makeExam([
            'opens_at' => Carbon::now()->addDays(3),
            'closes_at' => Carbon::now()->addDays(4),
            'registration_opens_at' => Carbon::now()->addDays(2),
            'registration_closes_at' => Carbon::now()->addDays(3),
        ]);
        ['csrf' => $csrf] = $this->signedInStudent();

        /* پیش از باز شدن پنجرهٔ ثبت‌نام ⇒ ۴۰۹ (نه ۲۰۰ بی‌معنا). */
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $csrf)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'REGISTRATION_CLOSED');
    }

    public function test_guest_cannot_register(): void
    {
        ['exam' => $exam] = $this->makeExam();

        $this->postJson('/api/v1/exams/'.$exam->getKey().'/registrations', [])
            ->assertStatus(401);
    }

    // ── شروع Attempt ────────────────────────────────────────────────────

    public function test_starting_an_attempt_returns_questions_without_the_answer_key(): void
    {
        ['exam' => $exam] = $this->makeExam(questionCount: 2);
        ['csrf' => $csrf] = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $csrf)->assertStatus(201);

        $response = $this->startAttempt($exam, $csrf)->assertStatus(201);

        $response->assertJsonPath('data.attempt.status', ExamAttempt::STATUS_IN_PROGRESS);
        $this->assertCount(2, $response->json('data.questions'));
        $this->assertSame(false, $response->json('data.resumed'));

        /* هیچ کلیدی نباید در پاسخ باشد. */
        $body = $response->getContent();
        $this->assertStringNotContainsString('correct_option_id', $body);
        $this->assertStringNotContainsString('key_snapshot', $body);
        $this->assertStringNotContainsString('explanation', $body);
    }

    public function test_an_unregistered_student_cannot_start_a_coordinated_exam(): void
    {
        ['exam' => $exam] = $this->makeExam();
        ['csrf' => $csrf] = $this->signedInStudent();

        $this->startAttempt($exam, $csrf)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'NOT_REGISTERED');
    }

    public function test_attempt_limit_is_enforced(): void
    {
        ['exam' => $exam] = $this->makeExam(['attempt_limit' => 1]);
        ['csrf' => $csrf] = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $csrf)->assertStatus(201);

        $attemptId = $this->startAttempt($exam, $csrf)->assertStatus(201)->json('data.attempt.id');

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$attemptId.'/finish', [], $csrf)->assertOk();

        $this->startAttempt($exam, $csrf)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ATTEMPT_LIMIT_REACHED');
    }

    public function test_starting_twice_returns_the_same_open_attempt(): void
    {
        ['exam' => $exam] = $this->makeExam();
        ['csrf' => $csrf] = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $csrf)->assertStatus(201);

        $first = $this->startAttempt($exam, $csrf)->assertStatus(201)->json('data.attempt.id');
        $second = $this->startAttempt($exam, $csrf)->assertOk();

        $this->assertSame($first, $second->json('data.attempt.id'));
        $this->assertTrue($second->json('data.resumed'));
        $this->assertSame(1, ExamAttempt::query()->where('exam_id', $exam->getKey())->count());
    }

    public function test_start_with_an_idempotency_key_replays_the_same_response(): void
    {
        ['exam' => $exam] = $this->makeExam();
        ['csrf' => $csrf] = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $csrf)->assertStatus(201);

        $key = ['Idempotency-Key' => 'start-key-1'];

        $first = $this->startAttempt($exam, $csrf, $key)->assertStatus(201);
        $second = $this->startAttempt($exam, $csrf, $key)->assertStatus(201);

        $this->assertSame($first->json('data.attempt.id'), $second->json('data.attempt.id'));
        $this->assertSame(1, ExamAttempt::query()->where('exam_id', $exam->getKey())->count());
    }

    public function test_same_idempotency_key_with_a_different_exam_conflicts(): void
    {
        ['exam' => $examA] = $this->makeExam();
        ['exam' => $examB] = $this->makeExam();
        ['csrf' => $csrf] = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$examA->getKey().'/registrations', [], $csrf)->assertStatus(201);
        $this->postJsonWithOrigin('/api/v1/exams/'.$examB->getKey().'/registrations', [], $csrf)->assertStatus(201);

        $key = ['Idempotency-Key' => 'shared-key'];

        $this->startAttempt($examA, $csrf, $key)->assertStatus(201);

        $this->startAttempt($examB, $csrf, $key)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'IDEMPOTENCY_KEY_REUSED');
    }

    // ── پاسخ ────────────────────────────────────────────────────────────

    public function test_a_student_can_save_and_revise_an_answer(): void
    {
        $context = $this->openAttempt();
        $questionId = $context['questions']->first()->getKey();

        $first = $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $questionId,
            'selectedOptionId' => $this->optionIdAt($context['questions']->first(), 0),
            'revision' => 0,
        ], $context['csrf'])->assertOk();

        $this->assertSame(1, $first->json('data.revision'));

        $second = $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $questionId,
            'selectedOptionId' => $this->optionIdAt($context['questions']->first(), 1),
            'revision' => 1,
        ], $context['csrf'])->assertOk();

        $this->assertSame(2, $second->json('data.revision'));
        $this->assertSame(1, ExamAnswer::query()->where('attempt_id', $context['attemptId'])->count());
    }

    public function test_a_stale_revision_conflicts(): void
    {
        $context = $this->openAttempt();
        $question = $context['questions']->first();

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $this->optionIdAt($question, 0),
            'revision' => 0,
        ], $context['csrf'])->assertOk();

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $this->optionIdAt($question, 1),
            'revision' => 0,
        ], $context['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'REVISION_CONFLICT');
    }

    public function test_an_option_from_another_question_is_rejected(): void
    {
        $context = $this->openAttempt();
        $question = $context['questions']->first();
        $foreign = $this->foreignOptionId();

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $foreign,
            'revision' => 0,
        ], $context['csrf'])
            ->assertStatus(422)
            ->assertFieldError('selectedOptionId');
    }

    public function test_a_question_from_another_exam_is_rejected(): void
    {
        $context = $this->openAttempt();
        ['questions' => $otherQuestions] = $this->makeExam();

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $otherQuestions->first()->getKey(),
            'selectedOptionId' => $this->optionIdAt($otherQuestions->first(), 0),
            'revision' => 0,
        ], $context['csrf'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'QUESTION_NOT_IN_ATTEMPT');
    }

    // ── پایان و تصحیح ───────────────────────────────────────────────────

    public function test_finish_grades_on_the_server_and_produces_an_immutable_result(): void
    {
        $context = $this->openAttempt(3);
        $questions = $context['questions'];

        /* دو پاسخ درست و یک بی‌پاسخ ⇒ ۲ از ۳. */
        foreach ([0, 1] as $index) {
            $correctIndex = $this->correctOptionIndex($questions[$index]);

            $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
                'questionId' => $questions[$index]->getKey(),
                'selectedOptionId' => $this->optionIdAt($questions[$index], $correctIndex),
                'revision' => 0,
            ], $context['csrf'])->assertOk();
        }

        $finish = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $this->assertSame(2, $finish->json('data.result.correct_count'));
        $this->assertSame(0, $finish->json('data.result.wrong_count'));
        $this->assertSame(1, $finish->json('data.result.blank_count'));
        $this->assertSame(66.7, $finish->json('data.result.percentage'));
        $this->assertSame(ExamAttempt::STATUS_GRADED, $finish->json('data.attempt.status'));

        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    public function test_negative_marking_is_applied_from_the_exam_not_from_the_client(): void
    {
        $context = $this->openAttempt(2, ['negative_marking' => -0.5]);
        $questions = $context['questions'];

        /* یکی درست، یکی غلط ⇒ 1 - 0.5 = 0.5 از 2 ⇒ ۲۵٪. */
        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $questions[0]->getKey(),
            'selectedOptionId' => $this->optionIdAt($questions[0], $this->correctOptionIndex($questions[0])),
            'revision' => 0,
        ], $context['csrf'])->assertOk();

        $wrongIndex = $this->correctOptionIndex($questions[1]) === 0 ? 1 : 0;

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $questions[1]->getKey(),
            'selectedOptionId' => $this->optionIdAt($questions[1], $wrongIndex),
            /* کلاینت تلاش می‌کند جریمه را صفر کند — فیلد ناشناخته بی‌اثر است. */
            'negativeMarking' => 0,
            'revision' => 0,
        ], $context['csrf'])->assertOk();

        $finish = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $this->assertSame(-0.5, $finish->json('data.result.negative_marking'));
        $this->assertSame(0.5, $finish->json('data.result.score'));
        $this->assertSame(25.0, (float) $finish->json('data.result.percentage'));
    }

    public function test_double_finish_is_idempotent_and_does_not_regrade(): void
    {
        $context = $this->openAttempt(2);

        $first = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();
        $second = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $this->assertSame($first->json('data.result.id'), $second->json('data.result.id'));
        $this->assertTrue($second->json('data.idempotent'));
        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    public function test_finish_with_an_idempotency_key_replays_the_same_result(): void
    {
        $context = $this->openAttempt(2);
        $key = ['Idempotency-Key' => 'finish-key-1'];

        $first = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], array_merge($context['csrf'], $key))->assertOk();
        $second = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], array_merge($context['csrf'], $key))->assertOk();

        $this->assertSame($first->json('data.result.id'), $second->json('data.result.id'));
        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    public function test_answers_are_rejected_after_the_deadline(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1]);
        $question = $context['questions']->first();

        /* مهلت را به گذشته می‌بریم — ساعت سرور معیار است، نه ساعت کلاینت.
           `started_at` هم عقب می‌رود چون CHECK «مهلت بعد از شروع» را نگه می‌داریم. */
        ExamAttempt::query()->whereKey($context['attemptId'])->update([
            'started_at' => Carbon::now()->subMinutes(10),
            'deadline_at' => Carbon::now()->subMinute(),
        ]);

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $this->optionIdAt($question, 0),
            'revision' => 0,
        ], $context['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'TIME_OVER');
    }

    public function test_an_expired_attempt_is_finalized_as_expired_on_read(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 0]);

        ExamAttempt::query()->whereKey($context['attemptId'])->update([
            'started_at' => Carbon::now()->subMinutes(20),
            'deadline_at' => Carbon::now()->subMinutes(5),
        ]);

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'])->assertOk();

        $attempt = ExamAttempt::query()->findOrFail($context['attemptId']);

        $this->assertSame(ExamAttempt::STATUS_EXPIRED, $attempt->status);
        $this->assertSame(ExamAttempt::REASON_TIMEOUT, $attempt->submit_reason);
        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    // ── کارنامه و انتشار ────────────────────────────────────────────────

    public function test_the_result_is_hidden_until_the_release_moment(): void
    {
        $context = $this->openAttempt(2, ['result_release_at' => Carbon::now()->addHours(2)]);

        $finish = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        /* بدنهٔ finish هم نباید نمره را لو بدهد. */
        $this->assertNull($finish->json('data.result'));
        $this->assertFalse($finish->json('data.result_released'));

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/result')
            ->assertOk()
            ->assertJsonPath('data.state', 'processing');
    }

    public function test_the_result_is_visible_after_release(): void
    {
        $context = $this->openAttempt(2, ['result_release_at' => Carbon::now()->addMinutes(30)]);

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        Exam::query()->whereKey($context['exam']->getKey())->update([
            'result_release_at' => Carbon::now()->subMinute(),
        ]);

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/result')
            ->assertOk()
            ->assertJsonPath('data.state', 'ready')
            ->assertJsonStructure(['data' => ['result' => ['score', 'percentage', 'correct_count', 'wrong_count', 'blank_count']]]);
    }

    public function test_review_returns_the_key_only_after_release(): void
    {
        $context = $this->openAttempt(2, [
            'rules' => ['allow_review' => true],
            'result_release_at' => Carbon::now()->addHour(),
        ]);

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/review')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'RESULT_NOT_RELEASED');

        Exam::query()->whereKey($context['exam']->getKey())->update(['result_release_at' => Carbon::now()->subMinute()]);

        $review = $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/review')->assertOk();

        $this->assertNotEmpty($review->json('data.questions.0.correct_option_id'));
        $this->assertArrayHasKey('is_correct', $review->json('data.questions.0'));
    }

    public function test_review_is_rejected_when_the_rule_forbids_it(): void
    {
        $context = $this->openAttempt(2, ['rules' => ['allow_review' => false]]);

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/review')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'REVIEW_NOT_ALLOWED');
    }

    // ── رتبه‌بندی ───────────────────────────────────────────────────────

    public function test_ranking_is_built_from_released_results_only(): void
    {
        ['exam' => $exam, 'questions' => $questions] = $this->makeExam([], 2);

        /* دو شرکت‌کنندهٔ واقعی: اولی صفر از دو، دومی دو از دو.
           رتبه و صدک باید از همین نتایج منتشرشده بیاید، نه از امتیاز کلاینت. */
        $this->sitExam($exam, $questions, 0, ['phone' => '09120000001']);
        $this->sitExam($exam, $questions, 2, ['phone' => '09120000002']);

        $ranking = $this->getJson('/api/v1/exams/'.$exam->getKey().'/ranking')->assertOk();

        $this->assertSame(2, $ranking->json('data.ranking.participants_count'));
        $this->assertSame(1, $ranking->json('data.ranking.me.rank'));
        /* فرمول legacy: صدک = (تعداد − رتبه) / تعداد ⇒ (۲−۱)/۲ = ۵۰ */
        $this->assertSame(50, $ranking->json('data.ranking.me.percentile'));
        $this->assertSame(100.0, (float) $ranking->json('data.ranking.me.percentage'));
        $this->assertSame(100, $ranking->json('data.ranking.top_percent'));
        $this->assertSame(50, $ranking->json('data.ranking.median_percent'));
        $this->assertSame(50.0, (float) $ranking->json('data.ranking.average_percent'));
    }

    public function test_ranking_is_unavailable_before_release(): void
    {
        $context = $this->openAttempt(2, ['result_release_at' => Carbon::now()->addHour()]);

        $this->getJson('/api/v1/exams/'.$context['exam']->getKey().'/ranking')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'RESULT_NOT_RELEASED');
    }

    public function test_ranking_does_not_leak_participant_identity(): void
    {
        $context = $this->openAttempt(2);
        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $payload = $this->getJson('/api/v1/exams/'.$context['exam']->getKey().'/ranking')->assertOk()->json('data.ranking');

        $this->assertSame(
            ['exam_id', 'participants_count', 'top_percent', 'median_percent', 'average_percent', 'me'],
            array_keys($payload),
        );
        $this->assertStringNotContainsString('@', json_encode($payload));
    }

    // ── کمکی ────────────────────────────────────────────────────────────
}
