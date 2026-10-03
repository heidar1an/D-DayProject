<?php

namespace Tests\Feature\Gamification;

use App\Events\Learning\StudySessionRecorded;
use App\Models\Streak;
use App\Models\User;
use App\Models\UserChallenge;
use App\Models\XpTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۱۴ — زنجیرهٔ مطالعه، چالش‌ها و نشان‌ها.
 *
 *   • Streak فقط از رخداد معتبر؛ باکت روز از ساعت سرور (timezone پروژه).
 *   • چالش با اولین فعالیت دورهٔ جاری فعال می‌شود؛ تکمیلش XP یکتا می‌دهد.
 *   • نشان deterministic و idempotent است.
 */
class StreakChallengeAchievementTest extends TestCase
{
    use BuildsQuestionBank, RefreshDatabase;

    private function newUser(string $phone): User
    {
        $this->postJsonWithOrigin('/api/v1/auth/register', [
            'phone' => $phone,
            'password' => 'Tapesh#1402',
        ])->assertCreated();

        return User::query()->where('phone', $phone)->firstOrFail();
    }

    private function recordSession(User $user, int $seconds, string $id): void
    {
        StudySessionRecorded::dispatch($user->getKey(), $id, 'lesson', $seconds);
    }

    /* ───────────────────────── زنجیره ───────────────────────── */

    public function test_first_valid_activity_starts_the_streak(): void
    {
        $user = $this->newUser('09120000001');

        $this->recordSession($user, 1200, 's1');

        $streak = Streak::query()->sole();
        $this->assertSame(1, (int) $streak->current_count);
        $this->assertSame(now()->toDateString(), $streak->last_day->toDateString());
    }

    public function test_repeating_the_same_day_is_idempotent(): void
    {
        $user = $this->newUser('09120000001');

        $this->recordSession($user, 1200, 's1');
        $this->recordSession($user, 1500, 's2');

        $this->assertSame(1, (int) Streak::query()->sole()->current_count);
        $this->assertSame(2, XpTransaction::query()->where('source_type', XpTransaction::SOURCE_STUDY_SESSION)->count());
    }

    public function test_consecutive_days_extend_and_missed_days_reset(): void
    {
        $user = $this->newUser('09120000001');

        Carbon::setTestNow('2026-10-01 10:00:00');
        $this->recordSession($user, 1200, 'd1');
        $this->assertSame(1, (int) Streak::query()->sole()->current_count);

        Carbon::setTestNow('2026-10-02 10:00:00');
        $this->recordSession($user, 1200, 'd2');
        $this->assertSame(2, (int) Streak::query()->sole()->current_count);

        Carbon::setTestNow('2026-10-04 10:00:00'); /* یک روز جاافتاده. */
        $this->recordSession($user, 1200, 'd4');
        $this->assertSame(1, (int) Streak::query()->sole()->current_count);
        $this->assertSame(2, (int) Streak::query()->sole()->longest_count);

        Carbon::setTestNow();
    }

    public function test_short_session_extends_streak_but_awards_no_xp(): void
    {
        $user = $this->newUser('09120000001');

        $this->recordSession($user, 60, 'short-1');

        $this->assertSame(1, (int) Streak::query()->sole()->current_count);
        $this->assertSame(0, XpTransaction::query()->count());
    }

    /* ───────────────────────── چالش‌ها ───────────────────────── */

    public function test_challenge_activates_progresses_and_rewards_once(): void
    {
        $this->seed(\Database\Seeders\ChallengeSeeder::class);
        $user = $this->newUser('09120000001');

        /* daily-questions: هدف ۵ پاسخ درست. */
        for ($i = 1; $i <= 5; $i++) {
            \App\Events\QuestionBank\QuestionAnswered::dispatch(
                $user->getKey(), 'q'.$i, 'attempt-'.$i, true,
            );
        }

        $userChallenge = UserChallenge::query()->sole();
        $this->assertSame(UserChallenge::STATUS_COMPLETED, $userChallenge->status);
        $this->assertSame(5, (int) $userChallenge->progress);
        $this->assertSame(now()->toDateString(), $userChallenge->period_key);

        /* پاسخ ششم: progress به سقف می‌ماند و پاداش تکرار نمی‌شود. */
        \App\Events\QuestionBank\QuestionAnswered::dispatch($user->getKey(), 'q6', 'attempt-6', true);

        $this->assertSame(5, (int) $userChallenge->refresh()->progress);
        $this->assertSame(1, UserChallenge::query()->count());

        /* XP: شش پاسخ درست (۶×۵=۳۰) + یک پاداش چالش (۲۵) = ۵۵. */
        $xp = (int) XpTransaction::query()->where('user_id', $user->getKey())->sum('delta');
        $this->assertSame(55, $xp);
        $this->assertSame(
            1,
            XpTransaction::query()->where('source_type', XpTransaction::SOURCE_CHALLENGE_COMPLETED)->count(),
        );
    }

    public function test_wrong_answers_do_not_feed_the_challenge(): void
    {
        $this->seed(\Database\Seeders\ChallengeSeeder::class);
        $user = $this->newUser('09120000001');

        \App\Events\QuestionBank\QuestionAnswered::dispatch($user->getKey(), 'q1', 'attempt-1', false);

        $this->assertSame(0, UserChallenge::query()->count());
    }

    /* ───────────────────────── نشان‌ها ───────────────────────── */

    public function test_achievement_unlocks_exactly_once_and_from_real_data(): void
    {
        $this->seed(\Database\Seeders\AchievementSeeder::class);
        $page = $this->makePublishedPage();
        $user = $this->newUser('09120000001');

        /* مسیر سبز + تکمیل واقعی صفحه ⇒ قدم completed ⇒ نشان. */
        $login = $this->postJsonWithOrigin('/api/v1/auth/login', [
            'phone' => '09120000001',
            'password' => 'Tapesh#1402',
        ])->assertOk();
        $this->withAuthCookies($login);
        $this->getJson('/api/v1/me/green-path/roadmap')->assertOk();

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'completed' => true,
        ], $this->csrfHeader($login))->assertOk();

        /* replay رویداد، ردیف تکراری نمی‌سازد. */
        \App\Events\Learning\LessonCompleted::dispatch($user->getKey(), 'page:'.$page->getKey(), (string) $page->lesson_id);

        $this->assertDatabaseCount('user_achievements', 1);
        $this->assertDatabaseHas('user_achievements', ['user_id' => $user->getKey()]);

        $this->withAuthCookies($this->postJsonWithOrigin('/api/v1/auth/login', [
            'phone' => '09120000001',
            'password' => 'Tapesh#1402',
        ]));

        $this->getJson('/api/v1/me/achievements')
            ->assertOk()
            ->assertJsonPath('data.items.2.unlocked', true)
            ->assertJsonPath('data.items.2.code', 'first_steps');
    }
}
