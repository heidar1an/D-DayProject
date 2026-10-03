<?php

namespace Tests\Feature\Exam;

use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamResult;
use App\Services\Exam\ExamAttemptService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * همزمانی Exam Engine — فاز ۷.
 *
 * ⚠️ صداقت روش‌شناختی: PHPUnit تک‌ریسمانی است و «دو درخواست هم‌زمان واقعی» را
 * اجرا نمی‌کند. آنچه اینجا **واقعاً** تست می‌شود:
 *   1. مکانیزم‌های قفل/قید که همزمانی را ایمن می‌کنند (قید یکتا، گذار وضعیت،
 *      قفل خوش‌بینانه) — اینها همان چیزی هستند که در رقابت واقعی تصمیم می‌گیرند؛
 *   2. ترتیب‌های ممکن دو عملیات پشت‌سرهم روی یک ردیف.
 * آنچه اینجا تست **نمی‌شود** و در گزارش به‌عنوان «تأییدنشده» ثبت شده:
 * رقابت واقعی چندپروسه‌ای/چنداتصالی روی PostgreSQL.
 *
 * هر تست روی **دادهٔ ذخیره‌شده** تأیید می‌کند، نه روی شکل پاسخ.
 */
class ExamConcurrencyTest extends TestCase
{
    use BuildsExams, BuildsQuestionBank, RefreshDatabase;

    /** دو finish پشت‌سرهم — حتی با کلید idempotency متفاوت — فقط یک نتیجه می‌سازند. */
    public function test_two_finishes_with_different_keys_produce_exactly_one_result(): void
    {
        $context = $this->openAttempt(2);
        $service = app(ExamAttemptService::class);
        $now = Carbon::now();

        $present = static fn (array $payload): array => [
            'attempt' => $payload['attempt'],
            'result' => $payload['result'],
            'idempotent' => $payload['idempotent'],
        ];

        $first = $service->finish($context['user'], $context['attemptId'], 'race-a', $present, $now);
        $second = $service->finish($context['user'], $context['attemptId'], 'race-b', $present, $now);

        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
        $this->assertSame(
            $first->data['result']->getKey(),
            $second->data['result']->getKey(),
            'پایان دوم باید همان نتیجه را برگرداند، نه نتیجهٔ تازه.',
        );
        $this->assertTrue($second->data['idempotent']);
    }

    /** لایهٔ دوم دفاع: خودِ دیتابیس اجازهٔ ردیف دوم نتیجه برای یک Attempt را نمی‌دهد. */
    public function test_the_database_refuses_a_second_result_row_for_the_same_attempt(): void
    {
        $context = $this->openAttempt(2);
        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $existing = ExamResult::query()->where('attempt_id', $context['attemptId'])->firstOrFail();

        $this->expectException(UniqueConstraintViolationException::class);

        /* حتی با شناسهٔ تازه، `UNIQUE(attempt_id)` جلوی ردیف دوم را می‌گیرد. */
        $existing->replicate()->save();
    }

    /** دو درخواست **یکسان** پاسخ در یک revision: یکی برنده، دیگری ۴۰۹. */
    public function test_two_identical_answer_writes_at_the_same_revision_cannot_both_win(): void
    {
        $context = $this->openAttempt(2);
        $question = $context['questions']->first();

        $body = [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $this->optionIdAt($question, 0),
            'revision' => 0,
        ];

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', $body, $context['csrf'])->assertOk();

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', $body, $context['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'REVISION_CONFLICT');

        $this->assertSame(1, ExamAnswer::query()->where('attempt_id', $context['attemptId'])->count());
        $this->assertSame(1, (int) ExamAnswer::query()->where('attempt_id', $context['attemptId'])->value('revision'));
    }

    /** قید یکتا روی (attempt, question) اجازهٔ دو ردیف پاسخ برای یک سؤال را نمی‌دهد. */
    public function test_the_database_refuses_two_answer_rows_for_the_same_question(): void
    {
        $context = $this->openAttempt(2);
        $question = $context['questions']->first();

        $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/answers', [
            'questionId' => $question->getKey(),
            'selectedOptionId' => $this->optionIdAt($question, 0),
            'revision' => 0,
        ], $context['csrf'])->assertOk();

        $existing = ExamAnswer::query()->where('attempt_id', $context['attemptId'])->firstOrFail();

        $this->expectException(UniqueConstraintViolationException::class);

        $existing->replicate()->save();
    }

    /** دو start بدون کلید idempotency: دومی «ادامه» می‌دهد، نه Attempt تازه. */
    public function test_two_starts_without_a_key_resume_the_same_attempt(): void
    {
        $context = $this->openAttempt(2);

        $again = $this->startAttempt($context['exam'], $context['csrf'])->assertOk();

        $this->assertSame($context['attemptId'], $again->json('data.attempt.id'));
        $this->assertTrue($again->json('data.resumed'));
        $this->assertSame(1, ExamAttempt::query()->where('exam_id', $context['exam']->getKey())->count());
    }

    /** دو start با **همان** کلید: یک Attempt، و پاسخ بازپخش‌شده. */
    public function test_two_starts_with_the_same_key_produce_one_attempt(): void
    {
        ['exam' => $exam] = $this->makeExam([], 2);
        ['csrf' => $csrf] = $this->signedInStudent();
        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $csrf)->assertStatus(201);

        $key = ['Idempotency-Key' => 'concurrent-start'];

        $first = $this->startAttempt($exam, $csrf, $key)->assertStatus(201);
        $second = $this->startAttempt($exam, $csrf, $key)->assertStatus(201);

        $this->assertSame($first->json('data.attempt.id'), $second->json('data.attempt.id'));
        $this->assertSame(1, ExamAttempt::query()->where('exam_id', $exam->getKey())->count());
    }

    /** ترتیب ۱: انقضا اول، finish بعد ⇒ همان یک نتیجهٔ expired، بدون تصحیح دوباره. */
    public function test_expiry_first_then_finish_yields_a_single_expired_result(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 0]);

        /* مهلت را به گذشته می‌بریم (started_at هم عقب می‌رود تا CHECK بشکند نشود). */
        ExamAttempt::query()->whereKey($context['attemptId'])->update([
            'started_at' => Carbon::now()->subMinutes(20),
            'deadline_at' => Carbon::now()->subMinutes(5),
        ]);

        $service = app(ExamAttemptService::class);
        $now = Carbon::now();

        $expired = $service->expireStaleFor($context['exam'], $context['user'], $now);
        $this->assertSame(1, $expired);

        $present = static fn (array $payload): array => ['attempt' => $payload['attempt'], 'result' => $payload['result']];
        $service->finish($context['user'], $context['attemptId'], 'late-finish', $present, $now);

        $attempt = ExamAttempt::query()->findOrFail($context['attemptId']);

        $this->assertSame(ExamAttempt::STATUS_EXPIRED, $attempt->status);
        $this->assertSame(ExamAttempt::REASON_TIMEOUT, $attempt->submit_reason);
        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    /** ترتیب ۲: finish اول (در پنجرهٔ گریس) ⇒ sweep بعدی هیچ کاری نمی‌کند. */
    public function test_finish_first_then_the_sweep_changes_nothing(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 600]);

        ExamAttempt::query()->whereKey($context['attemptId'])->update([
            'started_at' => Carbon::now()->subMinutes(20),
            'deadline_at' => Carbon::now()->subMinute(),
        ]);

        $finish = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $this->assertSame(ExamAttempt::REASON_GRACE, $finish->json('data.attempt.submit_reason'));
        $this->assertSame(ExamAttempt::STATUS_GRADED, $finish->json('data.attempt.status'));

        $swept = app(ExamAttemptService::class)->expireStaleFor($context['exam'], $context['user'], Carbon::now());

        $this->assertSame(0, $swept, 'Attempt بسته نباید دوباره نهایی شود.');
        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    /** sweep تکراری روی Attempt بسته: همیشه صفر، هرگز تصحیح دوباره. */
    public function test_repeated_sweeps_do_not_regrade(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 0]);

        ExamAttempt::query()->whereKey($context['attemptId'])->update([
            'started_at' => Carbon::now()->subMinutes(20),
            'deadline_at' => Carbon::now()->subMinutes(5),
        ]);

        $service = app(ExamAttemptService::class);

        $this->assertSame(1, $service->expireStaleFor($context['exam'], $context['user'], Carbon::now()));
        $this->assertSame(0, $service->expireStaleFor($context['exam'], $context['user'], Carbon::now()));

        $result = ExamResult::query()->where('attempt_id', $context['attemptId'])->firstOrFail();
        $gradedAt = $result->graded_at->toIso8601String();

        $service->expireStaleFor($context['exam'], $context['user'], Carbon::now()->addMinutes(5));

        $this->assertSame($gradedAt, $result->refresh()->graded_at->toIso8601String());
    }

    /** گذار معکوس ممنوع: Attempt بسته هرگز به in_progress برنمی‌گردد. */
    public function test_a_closed_attempt_never_returns_to_in_progress(): void
    {
        $context = $this->openAttempt(2);
        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $attempt = ExamAttempt::query()->findOrFail($context['attemptId']);
        $status = $attempt->status;

        $this->startAttempt($context['exam'], $context['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ATTEMPT_LIMIT_REACHED');

        $this->assertSame($status, $attempt->refresh()->status);
    }
}
