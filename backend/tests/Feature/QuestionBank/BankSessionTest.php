<?php

namespace Tests\Feature\QuestionBank;

use App\Models\Question;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۶ — Bank Session (انتخاب سؤال سمت سرور، عمر کوتاه).
 *
 * این «موتور آزمون» نیست: تایمر، ثبت‌نام و کارنامه در فاز ۷ می‌آیند. اینجا فقط
 * تأیید می‌شود که فهرست سؤال **از سرور** می‌آید، به کاربر گره می‌خورد، و کلید
 * پاسخ در آن نیست.
 */
class BankSessionTest extends TestCase
{
    use BuildsQuestionBank, RefreshDatabase;

    public function test_starting_a_session_requires_authentication(): void
    {
        $this->postJsonWithOrigin('/api/v1/bank/sessions', [])->assertStatus(401);
    }

    public function test_it_builds_a_server_side_selection(): void
    {
        foreach (range(1, 4) as $ignored) {
            $this->makeQuestion();
        }

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'count' => 3,
            'mode' => 'practice',
        ], $this->csrfHeader($session))
            ->assertStatus(201)
            ->assertJsonPath('data.bank_session.mode', 'practice')
            ->assertJsonCount(3, 'data.bank_session.questions');
    }

    public function test_the_session_payload_never_carries_the_answer_key(): void
    {
        $this->makeQuestion();

        $session = $this->register();
        $this->withAuthCookies($session);

        $content = $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'count' => 1,
        ], $this->csrfHeader($session))->assertStatus(201)->getContent();

        // گزینه‌ها عمومی‌اند؛ چیزی که نباید باشد، نشانه‌گذاری پاسخ است.
        $this->assertStringNotContainsString('correct_option_id', $content);
        $this->assertStringNotContainsString('explanation', $content);
        $this->assertStringNotContainsString('key_version', $content);
        $this->assertStringNotContainsString('is_correct', $content);
    }

    public function test_the_default_count_comes_from_config(): void
    {
        foreach (range(1, 3) as $ignored) {
            $this->makeQuestion();
        }

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/bank/sessions', [], $this->csrfHeader($session))
            ->assertStatus(201)
            ->assertJsonCount(3, 'data.bank_session.questions');
    }

    public function test_a_count_above_the_ceiling_is_rejected(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $max = (int) config('question_bank.bank_session.max_count');

        $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'count' => $max + 1,
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertFieldError('count');
    }

    public function test_an_unknown_mode_is_rejected(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'mode' => 'speedrun',
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertFieldError('mode');
    }

    public function test_an_unknown_filter_is_rejected_with_400(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'filters' => ['status' => 'draft'],
        ], $this->csrfHeader($session))
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    public function test_filters_narrow_the_selection_to_published_questions(): void
    {
        $easy = $this->makeQuestion(['difficulty' => 'easy'])['question'];
        $this->makeQuestion(['difficulty' => 'hard']);
        $this->makeQuestion(['difficulty' => 'easy'], 1, 4, false);

        $session = $this->register();
        $this->withAuthCookies($session);

        $questions = $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'filters' => ['difficulty' => 'easy'],
            'count' => 10,
        ], $this->csrfHeader($session))
            ->assertStatus(201)
            ->json('data.bank_session.questions');

        $this->assertCount(1, $questions);
        $this->assertSame($easy->getKey(), $questions[0]['id']);
    }

    public function test_client_supplied_question_ids_are_ignored(): void
    {
        foreach (range(1, 3) as $ignored) {
            $this->makeQuestion();
        }

        $session = $this->register();
        $this->withAuthCookies($session);

        // اگر `questionIds` محترم شمرده می‌شد، فهرست خالی برمی‌گشت.
        $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'questionIds' => [],
            'count' => 2,
        ], $this->csrfHeader($session))
            ->assertStatus(201)
            ->assertJsonCount(2, 'data.bank_session.questions');
    }

    public function test_the_owner_can_read_the_session_back_in_the_same_order(): void
    {
        foreach (range(1, 5) as $ignored) {
            $this->makeQuestion();
        }

        $session = $this->register();
        $this->withAuthCookies($session);

        $created = $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'count' => 4,
        ], $this->csrfHeader($session))->assertStatus(201);

        $id = $created->json('data.bank_session.session_id');
        $expected = array_column($created->json('data.bank_session.questions'), 'id');

        $fetched = $this->getJson('/api/v1/bank/sessions/'.$id)->assertOk();

        $this->assertSame($expected, array_column($fetched->json('data.bank_session.questions'), 'id'));
    }

    public function test_another_user_cannot_read_the_session(): void
    {
        foreach (range(1, 3) as $ignored) {
            $this->makeQuestion();
        }

        $owner = $this->register();
        $this->withAuthCookies($owner);

        $id = $this->postJsonWithOrigin('/api/v1/bank/sessions', ['count' => 2], $this->csrfHeader($owner))
            ->assertStatus(201)
            ->json('data.bank_session.session_id');

        $intruder = $this->register(['phone' => '09120000003']);
        $this->withAuthCookies($intruder);

        $this->getJson('/api/v1/bank/sessions/'.$id)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_an_expired_or_unknown_session_is_404(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->getJson('/api/v1/bank/sessions/'.Str::uuid())->assertStatus(404);
        $this->getJson('/api/v1/bank/sessions/not-a-uuid')->assertStatus(404);
    }

    public function test_a_session_question_that_gets_unpublished_disappears(): void
    {
        $built = $this->makeQuestion();

        $session = $this->register();
        $this->withAuthCookies($session);

        $id = $this->postJsonWithOrigin('/api/v1/bank/sessions', ['count' => 1], $this->csrfHeader($session))
            ->assertStatus(201)
            ->json('data.bank_session.session_id');

        $built['question']->forceFill(['status' => Question::STATUS_ARCHIVED])->save();

        $this->getJson('/api/v1/bank/sessions/'.$id)
            ->assertOk()
            ->assertJsonCount(0, 'data.bank_session.questions');
    }

    public function test_reading_a_session_requires_authentication(): void
    {
        $this->getJson('/api/v1/bank/sessions/'.Str::uuid())->assertStatus(401);
    }
}
