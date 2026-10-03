<?php

namespace Tests\Feature\QuestionBank;

use App\Models\HeartReward;
use App\Models\Question;
use App\Models\QuestionAttempt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۶ — پاسخ و تصحیح سمت سرور.
 *
 * مرز اعتماد اینجاست: کلاینت فقط «کدام گزینه» را می‌گوید. هیچ فیلد نتیجه‌ای از
 * بدنه خوانده نمی‌شود و هیچ محاسبه‌ای سمت کلاینت پذیرفته نمی‌شود.
 */
class QuestionAnswerTest extends TestCase
{
    use BuildsQuestionBank, RefreshDatabase;

    public function test_answering_requires_authentication(): void
    {
        $built = $this->makeQuestion();

        $this->postJsonWithOrigin('/api/v1/questions/'.$built['question']->getKey().'/answers', [
            'selectedOptionId' => $built['correct']->getKey(),
        ])->assertStatus(401);

        $this->assertSame(0, QuestionAttempt::query()->count());
    }

    public function test_a_correct_answer_is_graded_on_the_server_and_reveals_the_key(): void
    {
        $built = $this->makeQuestion();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $built['correct']->getKey(), 'timeSpent' => 42],
            $this->csrfHeader($session),
        )
            ->assertStatus(201)
            ->assertJsonPath('data.attempt.is_correct', true)
            ->assertJsonPath('data.attempt.question_version', 1)
            ->assertJsonPath('data.attempt.selected_option_id', $built['correct']->getKey())
            ->assertJsonPath('data.attempt.reward.awarded', true)
            ->assertJsonPath('data.attempt.reward.amount', 1)
            ->assertJsonPath('data.attempt.reveal.correct_option_id', $built['correct']->getKey())
            ->assertJsonPath('data.attempt.reveal.explanation.summary', 'توضیح کوتاه');

        $attempt = QuestionAttempt::query()->firstOrFail();

        $this->assertTrue($attempt->is_correct);
        $this->assertSame(42, (int) $attempt->time_spent_sec);
        $this->assertNotNull($attempt->answered_at);
    }

    public function test_a_wrong_answer_is_graded_on_the_server_and_awards_nothing(): void
    {
        $built = $this->makeQuestion();
        $session = $this->register();
        $this->withAuthCookies($session);

        $wrong = $built['options']->firstWhere('position', 2);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $wrong->getKey()],
            $this->csrfHeader($session),
        )
            ->assertStatus(201)
            ->assertJsonPath('data.attempt.is_correct', false)
            ->assertJsonPath('data.attempt.reward.awarded', false)
            ->assertJsonPath('data.attempt.reward.amount', 0);

        $this->assertSame(0, HeartReward::query()->count());
    }

    public function test_an_omitted_answer_is_recorded_as_incorrect_not_as_an_error(): void
    {
        $built = $this->makeQuestion();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => null],
            $this->csrfHeader($session),
        )
            ->assertStatus(201)
            ->assertJsonPath('data.attempt.is_correct', false)
            ->assertJsonPath('data.attempt.selected_option_id', null);
    }

    public function test_an_option_from_another_question_is_rejected(): void
    {
        $built = $this->makeQuestion();
        $foreign = $this->foreignOptionId();

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $foreign],
            $this->csrfHeader($session),
        )
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'OPTION_NOT_IN_QUESTION');

        $this->assertSame(0, QuestionAttempt::query()->count());
    }

    public function test_a_draft_question_cannot_be_answered(): void
    {
        $built = $this->makeQuestion([], 1, 4, false);
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $built['correct']->getKey()],
            $this->csrfHeader($session),
        )
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');

        $this->assertSame(0, QuestionAttempt::query()->count());
    }

    public function test_client_supplied_result_fields_have_no_effect(): void
    {
        $built = $this->makeQuestion();
        $wrong = $built['options']->firstWhere('position', 3);

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            [
                'selectedOptionId' => $wrong->getKey(),
                // همهٔ این‌ها باید بی‌اثر باشند — در rules وجود ندارند.
                'isCorrect' => true,
                'correctAnswer' => $wrong->getKey(),
                'correctOptionId' => $wrong->getKey(),
                'score' => 100,
                'negativeMarking' => false,
                'xp' => 5000,
                'heartReward' => 99,
                'reward' => 99,
                'answeredAt' => now()->subYear()->toIso8601String(),
                'question_version' => 999,
            ],
            $this->csrfHeader($session),
        )
            ->assertStatus(201)
            ->assertJsonPath('data.attempt.is_correct', false)
            ->assertJsonPath('data.attempt.question_version', 1)
            ->assertJsonPath('data.attempt.reward.amount', 0);

        $attempt = QuestionAttempt::query()->firstOrFail();

        $this->assertFalse($attempt->is_correct);
        $this->assertSame(0, HeartReward::query()->count());
        // زمان پاسخ از ساعت سرور آمده، نه از `answeredAt` کلاینت.
        $this->assertTrue($attempt->answered_at->greaterThan(now()->subMinute()));
    }

    public function test_the_time_spent_is_clamped_to_the_configured_ceiling(): void
    {
        $built = $this->makeQuestion();
        $session = $this->register();
        $this->withAuthCookies($session);

        $max = (int) config('question_bank.attempts.max_time_spent_seconds');

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $built['correct']->getKey(), 'timeSpent' => $max],
            $this->csrfHeader($session),
        )->assertStatus(201);

        $this->assertSame($max, (int) QuestionAttempt::query()->firstOrFail()->time_spent_sec);

        // بالاتر از سقف ⇒ ۴۲۲، نه clamp بی‌صدا.
        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $built['correct']->getKey(), 'timeSpent' => $max + 1],
            $this->csrfHeader($session),
        )->assertStatus(422);
    }

    public function test_the_same_attempt_key_replays_the_same_result(): void
    {
        $built = $this->makeQuestion();
        $session = $this->register();
        $this->withAuthCookies($session);

        $payload = ['selectedOptionId' => $built['correct']->getKey(), 'attemptKey' => 'attempt-1'];

        $first = $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            $payload,
            $this->csrfHeader($session),
        )->assertStatus(201);

        $second = $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            $payload,
            $this->csrfHeader($session),
        )->assertStatus(201);

        $this->assertSame(
            $first->json('data.attempt.attempt_id'),
            $second->json('data.attempt.attempt_id'),
        );

        $this->assertSame(1, QuestionAttempt::query()->count());
        $this->assertSame(1, HeartReward::query()->count());
    }

    public function test_the_same_attempt_key_with_a_different_answer_is_a_conflict(): void
    {
        $built = $this->makeQuestion();
        $session = $this->register();
        $this->withAuthCookies($session);

        $headers = $this->csrfHeader($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $built['correct']->getKey(), 'attemptKey' => 'attempt-2'],
            $headers,
        )->assertStatus(201);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            [
                'selectedOptionId' => $built['options']->firstWhere('position', 2)->getKey(),
                'attemptKey' => 'attempt-2',
            ],
            $headers,
        )
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'IDEMPOTENCY_KEY_REUSED');

        $this->assertSame(1, QuestionAttempt::query()->count());
    }

    public function test_hearts_are_awarded_once_per_question_per_server_day(): void
    {
        $first = $this->makeQuestion();
        $second = $this->makeQuestion();

        $session = $this->register();
        $this->withAuthCookies($session);

        foreach ([$first, $second] as $built) {
            $this->postJsonWithOrigin(
                '/api/v1/questions/'.$built['question']->getKey().'/answers',
                ['selectedOptionId' => $built['correct']->getKey()],
                $this->csrfHeader($session),
            )->assertStatus(201);
        }

        // همان سؤال، بار دوم در همان روز: پاسخ ثبت می‌شود ولی قلب تکرار نمی‌شود.
        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$first['question']->getKey().'/answers',
            ['selectedOptionId' => $first['correct']->getKey()],
            $this->csrfHeader($session),
        )
            ->assertStatus(201)
            ->assertJsonPath('data.attempt.is_correct', true)
            ->assertJsonPath('data.attempt.reward.awarded', false);

        $this->assertSame(3, QuestionAttempt::query()->count());
        $this->assertSame(2, HeartReward::query()->count());
        $this->assertSame(2, (int) HeartReward::query()->sum('amount'));
    }

    public function test_the_attempt_is_owned_by_the_session_user(): void
    {
        $built = $this->makeQuestion();

        $session = $this->register();
        $this->withAuthCookies($session);
        $me = $this->getJson('/api/v1/me')->json('data.user.id');

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $built['correct']->getKey()],
            $this->csrfHeader($session),
        )->assertStatus(201);

        $attempt = QuestionAttempt::query()->firstOrFail();

        $this->assertSame($me, $attempt->user_id);
        $this->assertNull($attempt->guest_id);
    }

    public function test_a_user_id_in_the_body_has_no_effect_on_ownership(): void
    {
        $built = $this->makeQuestion();
        $victim = User::factory()->create();

        $session = $this->register();
        $this->withAuthCookies($session);
        $me = $this->getJson('/api/v1/me')->json('data.user.id');

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $built['correct']->getKey(), 'userId' => $victim->getKey()],
            $this->csrfHeader($session),
        )->assertStatus(201);

        $this->assertSame($me, QuestionAttempt::query()->firstOrFail()->user_id);
    }

    public function test_an_archived_question_cannot_be_answered(): void
    {
        $built = $this->makeQuestion();
        $built['question']->forceFill(['status' => Question::STATUS_ARCHIVED])->save();

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$built['question']->getKey().'/answers',
            ['selectedOptionId' => $built['correct']->getKey()],
            $this->csrfHeader($session),
        )->assertStatus(404);
    }

    public function test_an_unknown_question_is_404(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.Str::uuid().'/answers',
            ['selectedOptionId' => null],
            $this->csrfHeader($session),
        )->assertStatus(404);
    }
}
