<?php

namespace Tests\Feature\Exam;

use App\Models\Exam;
use App\Models\ExamQuestion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * قفل نشت کلید پاسخ — فاز ۷.
 *
 * این تست **قرارداد امنیتی** را روی همهٔ پاسخ‌های عمومی می‌بندد: کلید پاسخ و
 * `explanation` تنها از یک مسیر و تنها پس از انتشار بیرون می‌آیند
 * (`GET /api/v1/exam-attempts/{id}/review`). هر مسیر دیگری که روزی فیلد تازه‌ای
 * اضافه کند و بی‌سروصدا کلید را ببرد، اینجا سرخ می‌شود.
 *
 * چرا رشته‌های ممنوع روی **بدنهٔ خام** چک می‌شوند: اگر روزی کسی یک Resource
 * تازه بسازد و فیلد را با نام متفاوتی بفرستد، بررسی سطح-آرایه آن را نمی‌بیند
 * ولی بررسی متن خام می‌بیند.
 */
class ExamAnswerKeyLeakTest extends TestCase
{
    use BuildsExams, BuildsQuestionBank, RefreshDatabase;

    /** نام‌هایی که اگر روزی در پاسخ عمومی ظاهر شوند، یعنی نشت رخ داده است. */
    private const FORBIDDEN = [
        'key_snapshot_encrypted',
        'correct_option_id',
        'correctOptionId',
        'correct_answer',
        'correctAnswer',
        'answer_key',
        'answerKey',
        'explanation',
        'is_correct',
    ];

    public function test_the_encrypted_key_column_is_hidden_when_the_model_is_serialized(): void
    {
        $context = $this->openAttempt(2);
        $question = ExamQuestion::query()->where('exam_id', $context['exam']->getKey())->firstOrFail();

        $serialized = $question->toArray();

        $this->assertArrayNotHasKey('key_snapshot_encrypted', $serialized);
        $this->assertStringNotContainsString('key_snapshot_encrypted', json_encode($serialized));

        /* کلید واقعاً وجود دارد و قابل خواندن است — فقط serialize نمی‌شود. */
        $this->assertNotEmpty($question->keySnapshot()['correct_option_id'] ?? null);
    }

    public function test_the_public_exam_listing_and_detail_never_expose_the_key(): void
    {
        $context = $this->openAttempt(2);

        $list = $this->getJson('/api/v1/exams')->assertOk();
        $detail = $this->getJson('/api/v1/exams/'.$context['exam']->getKey())->assertOk();

        $this->assertNoKeyMaterial($list->getContent(), 'exams.index');
        $this->assertNoKeyMaterial($detail->getContent(), 'exams.show');
    }

    public function test_starting_and_reading_an_attempt_never_expose_the_key(): void
    {
        $context = $this->openAttempt(2);

        $read = $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'])->assertOk();

        $this->assertNoKeyMaterial($read->getContent(), 'exam-attempts.show');
        $this->assertNotEmpty($read->json('data.questions'));

        /* هر سؤال باید گزینه داشته باشد — یعنی snapshot واقعاً آمده. */
        $this->assertNotEmpty($read->json('data.questions.0.options'));
    }

    public function test_the_finish_response_exposes_no_numbers_before_release(): void
    {
        $context = $this->openAttempt(2, ['result_release_at' => Carbon::now()->addHour()]);

        $finish = $this->postJsonWithOrigin(
            '/api/v1/exam-attempts/'.$context['attemptId'].'/finish',
            [],
            $context['csrf'],
        )->assertOk();

        $this->assertFalse($finish->json('data.result_released'));
        $this->assertNull($finish->json('data.result'));

        $body = (string) $finish->getContent();

        $this->assertNoKeyMaterial($body, 'exam-attempts.finish');

        /* حتی عدد نمره هم نباید در بدنه باشد — نه فقط null بودن فیلد result. */
        foreach (['percentage', 'correct_count', 'wrong_count', 'max_score'] as $metric) {
            $this->assertStringNotContainsString($metric, $body, "finish leaked {$metric} before release");
        }
    }

    public function test_the_result_endpoint_before_release_returns_only_state_and_release_at(): void
    {
        $context = $this->openAttempt(2, ['result_release_at' => Carbon::now()->addHour()]);

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $result = $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/result')->assertOk();

        $this->assertSame('processing', $result->json('data.state'));
        $this->assertSame(
            ['state', 'release_at'],
            array_keys($result->json('data')),
        );

        $this->assertNoKeyMaterial($result->getContent(), 'exam-attempts.result');
    }

    public function test_review_is_the_only_place_the_key_appears_and_it_matches_the_snapshot(): void
    {
        $context = $this->openAttempt(2);
        $question = $context['questions']->first();

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $review = $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/review')->assertOk();

        $item = collect($review->json('data.questions'))
            ->firstWhere('exam_question_id', $question->getKey());

        $this->assertNotNull($item, 'review باید همان سؤال‌های snapshot را برگرداند.');
        $this->assertSame($question->correctOptionId(), $item['correct_option_id']);
        $this->assertArrayHasKey('is_correct', $item);

        /* گزینهٔ درست باید یکی از گزینه‌های همان snapshot باشد. */
        $this->assertContains($item['correct_option_id'], $question->optionIds());
    }

    public function test_the_review_payload_is_never_reachable_for_an_unfinished_attempt(): void
    {
        $context = $this->openAttempt(2);

        $this->getJson('/api/v1/exam-attempts/'.$context['attemptId'].'/review')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ATTEMPT_NOT_FINISHED');
    }

    /** هیچ‌کدام از نام‌های ممنوع نباید در بدنهٔ خام باشند. */
    private function assertNoKeyMaterial(string $body, string $where): void
    {
        foreach (self::FORBIDDEN as $needle) {
            $this->assertStringNotContainsString($needle, $body, "{$where} leaked '{$needle}'");
        }
    }
}
