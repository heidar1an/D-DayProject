<?php

namespace Tests\Feature\QuestionBank;

use App\Models\Question;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsQuestionBank;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * جدایی کلید پاسخ — سخت‌ترین قرارداد امنیتی فاز ۶.
 *
 * دو نوع سنجه اینجا هست:
 *   • **شکل صریح:** مجموعهٔ کلیدهای JSON دقیقاً برابر فهرست مجاز است. اگر روزی
 *     کسی `explanation` یا `correct_option_id` را «برای راحتی UI» اضافه کند،
 *     این تست می‌شکند — نه اینکه بی‌صدا لو برود.
 *   • **نشت محتوایی:** شناسهٔ گزینهٔ درست در بدنهٔ خام پاسخ نیست.
 */
class AnswerKeyIsolationTest extends TestCase
{
    use BuildsQuestionBank, InteractsWithAdmin, RefreshDatabase;

    private const PUBLIC_QUESTION_KEYS = [
        'id', 'stem', 'figure_key', 'type', 'difficulty', 'source', 'track',
        'year', 'exam_month', 'subject', 'topic', 'options',
    ];

    private const PUBLIC_OPTION_KEYS = ['id', 'position', 'label', 'body'];

    public function test_the_public_question_payload_has_exactly_the_allowed_keys(): void
    {
        $built = $this->makeQuestion();

        $question = $this->getJson('/api/v1/questions/'.$built['question']->getKey())
            ->assertOk()
            ->json('data.question');

        $keys = array_keys($question);
        sort($keys);

        $allowed = self::PUBLIC_QUESTION_KEYS;
        sort($allowed);

        $this->assertSame($allowed, $keys);

        $optionKeys = array_keys($question['options'][0]);
        sort($optionKeys);

        $expectedOptionKeys = self::PUBLIC_OPTION_KEYS;
        sort($expectedOptionKeys);

        $this->assertSame($expectedOptionKeys, $optionKeys);
    }

    public function test_the_list_payload_never_carries_the_answer_key(): void
    {
        $this->makeQuestion();

        $content = $this->getJson('/api/v1/questions')->assertOk()->getContent();

        /*
         * شناسهٔ گزینهٔ درست **به‌عنوان یک گزینه** در payload هست (گزینه‌ها عمومی‌اند)؛
         * چیزی که نباید باشد، «نشانه‌گذاری» آن به‌عنوان پاسخ است. پس اینجا دنبال
         * نام فیلدها می‌گردیم، نه شناسه‌ها.
         */
        $this->assertStringNotContainsString('correct_option_id', $content);
        $this->assertStringNotContainsString('correctAnswer', $content);
        $this->assertStringNotContainsString('explanation', $content);
        $this->assertStringNotContainsString('key_version', $content);
        $this->assertStringNotContainsString('is_correct', $content);
    }

    public function test_the_detail_payload_never_carries_the_answer_key(): void
    {
        $built = $this->makeQuestion();

        $content = $this->getJson('/api/v1/questions/'.$built['question']->getKey())
            ->assertOk()
            ->getContent();

        $this->assertStringNotContainsString('correct_option_id', $content);
        $this->assertStringNotContainsString('explanation', $content);
        $this->assertStringNotContainsString('key_version', $content);
    }

    public function test_the_answer_key_is_not_reachable_by_guessing_a_query_parameter(): void
    {
        $question = $this->makeQuestion()['question'];

        foreach (['include=key', 'with=key', 'includeAnswerKey=true', 'reveal=1'] as $query) {
            $this->getJson('/api/v1/questions/'.$question->getKey().'?'.$query)
                ->assertStatus(400)
                ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
        }
    }

    public function test_the_answer_key_is_not_exposed_even_to_an_admin_on_the_student_route(): void
    {
        $built = $this->makeQuestion();

        $this->seedRbac();
        $admin = $this->makeAdmin('super-admin');
        $this->actingAsAdmin($admin);

        $content = $this->getJson('/api/v1/questions/'.$built['question']->getKey())
            ->assertOk()
            ->getContent();

        $this->assertStringNotContainsString('correct_option_id', $content);
        $this->assertStringNotContainsString('explanation', $content);
        $this->assertStringNotContainsString('key_version', $content);
    }

    public function test_the_admin_payload_does_expose_the_key_so_isolation_is_not_accidental(): void
    {
        $built = $this->makeQuestion();

        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->getJson('/api/v1/admin/questions/'.$built['question']->getKey())
            ->assertOk()
            ->assertJsonPath('data.question.key.correct_option_id', $built['correct']->getKey())
            ->assertJsonPath('data.question.key.explanation.summary', 'توضیح کوتاه')
            ->assertJsonPath('data.question.status', Question::STATUS_PUBLISHED);
    }

    public function test_a_draft_question_key_is_never_public(): void
    {
        $built = $this->makeQuestion([], 1, 4, false);

        $this->getJson('/api/v1/questions')->assertOk()->assertJsonCount(0, 'data.questions');

        $content = $this->getJson('/api/v1/questions/'.$built['question']->getKey())->getContent();

        $this->assertStringNotContainsString($built['correct']->getKey(), $content);
    }
}
