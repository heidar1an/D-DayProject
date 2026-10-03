<?php

namespace Tests\Feature\Learning;

use App\Models\StudySession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۵ — نشست مطالعه.
 *
 * قاعدهٔ محوری: کلاینت «بازه» می‌گوید، سرور «مدت» را تعیین می‌کند. تست‌ها
 * مستقیماً همان مرز اعتماد را می‌کوبند (آینده، معکوس، قدیمی، اختلاف مدت، سقف).
 */
class StudySessionTest extends TestCase
{
    use BuildsQuestionBank, RefreshDatabase;

    /** @param array<string, mixed> $overrides */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'startedAt' => now()->subMinutes(30)->toIso8601String(),
            'endedAt' => now()->toIso8601String(),
            'source' => StudySession::SOURCE_LESSON,
        ], $overrides);
    }

    public function test_it_requires_authentication(): void
    {
        $this->postJsonWithOrigin('/api/v1/me/study-sessions', $this->payload())->assertStatus(401);
    }

    public function test_it_records_a_session_and_derives_the_duration_from_the_range(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $startedAt = now()->subMinutes(25);
        $endedAt = $startedAt->copy()->addSeconds(1500);

        $response = $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => $startedAt->toIso8601String(),
            'endedAt' => $endedAt->toIso8601String(),
            'source' => StudySession::SOURCE_POMODORO,
        ], $this->csrfHeader($session));

        $response->assertStatus(201)
            ->assertJsonPath('data.study_session.source', StudySession::SOURCE_POMODORO)
            ->assertJsonPath('data.study_session.duration_sec', 1500);

        $this->assertSame(1, StudySession::query()->count());
    }

    public function test_the_declared_duration_is_checked_against_the_real_range(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $startedAt = now()->subMinutes(10);

        // اختلاف ۳۰۰ ثانیه‌ای با بازهٔ واقعی — بیش از تلورانس.
        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => $startedAt->toIso8601String(),
            'endedAt' => $startedAt->copy()->addSeconds(300)->toIso8601String(),
            'durationSec' => 600,
            'source' => StudySession::SOURCE_LESSON,
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'DURATION_MISMATCH');

        $this->assertSame(0, StudySession::query()->count());
    }

    public function test_a_declared_duration_inside_the_tolerance_is_accepted(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $startedAt = now()->subMinutes(10);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => $startedAt->toIso8601String(),
            'endedAt' => $startedAt->copy()->addSeconds(300)->toIso8601String(),
            'durationSec' => 300 + (int) config('learning.study_sessions.duration_tolerance_seconds'),
            'source' => StudySession::SOURCE_LESSON,
        ], $this->csrfHeader($session))
            ->assertStatus(201)
            // مدت ذخیره‌شده همان مقدار **مشتق‌شده** است، نه عدد کلاینت.
            ->assertJsonPath('data.study_session.duration_sec', 300);
    }

    public function test_a_future_start_time_is_rejected(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $skew = (int) config('learning.study_sessions.max_clock_skew_seconds');

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => now()->addSeconds($skew + 600)->toIso8601String(),
            'source' => StudySession::SOURCE_LESSON,
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'TIMESTAMP_IN_FUTURE');
    }

    public function test_a_reversed_range_is_rejected(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => now()->subMinutes(5)->toIso8601String(),
            'endedAt' => now()->subMinutes(20)->toIso8601String(),
            'source' => StudySession::SOURCE_LESSON,
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'TIMESTAMP_RANGE_INVALID');
    }

    public function test_a_too_old_start_time_is_rejected(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $days = (int) config('learning.study_sessions.max_backdate_days');

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => now()->subDays($days + 5)->toIso8601String(),
            'source' => StudySession::SOURCE_LESSON,
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'TIMESTAMP_TOO_OLD');
    }

    public function test_a_duration_beyond_the_ceiling_is_rejected(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $max = (int) config('learning.study_sessions.max_duration_seconds');

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => now()->subSeconds($max + 60)->toIso8601String(),
            'endedAt' => now()->toIso8601String(),
            'source' => StudySession::SOURCE_LESSON,
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'DURATION_TOO_LONG');
    }

    public function test_an_unknown_source_is_rejected(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', $this->payload([
            'source' => 'course',
        ]), $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertFieldError('source');
    }

    public function test_a_session_may_be_recorded_without_a_lesson_page(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', $this->payload(), $this->csrfHeader($session))
            ->assertStatus(201)
            ->assertJsonPath('data.study_session.lesson_page_id', null);
    }

    public function test_a_lesson_page_that_is_not_visible_is_404(): void
    {
        $page = $this->makePageUnderDraftLesson();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', $this->payload([
            'lessonPageId' => $page->getKey(),
        ]), $this->csrfHeader($session))->assertStatus(404);

        $this->assertSame(0, StudySession::query()->count());
    }

    public function test_a_user_id_in_the_body_has_no_effect(): void
    {
        $victim = User::factory()->create();

        $session = $this->register();
        $this->withAuthCookies($session);
        $me = $this->getJson('/api/v1/me')->json('data.user.id');

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', $this->payload([
            'userId' => $victim->getKey(),
        ]), $this->csrfHeader($session))->assertStatus(201);

        $this->assertSame($me, StudySession::query()->firstOrFail()->user_id);
    }

    public function test_the_payload_never_exposes_the_owner_id(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $response = $this->postJsonWithOrigin('/api/v1/me/study-sessions', $this->payload(), $this->csrfHeader($session));

        $this->assertStringNotContainsString('user_id', $response->getContent());
    }

    public function test_the_same_idempotency_key_records_the_session_once(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $headers = $this->csrfHeader($session);
        $headers['Idempotency-Key'] = 'session-retry-1';

        $payload = $this->payload();

        $first = $this->postJsonWithOrigin('/api/v1/me/study-sessions', $payload, $headers);
        $second = $this->postJsonWithOrigin('/api/v1/me/study-sessions', $payload, $headers);

        $first->assertStatus(201);
        $second->assertStatus(201);

        $this->assertSame($first->json('data.study_session.id'), $second->json('data.study_session.id'));
        $this->assertSame(1, StudySession::query()->count());
    }

    public function test_sessions_are_counted_in_the_progress_summary(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $startedAt = now()->subMinutes(40);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => $startedAt->toIso8601String(),
            'endedAt' => $startedAt->copy()->addSeconds(1200)->toIso8601String(),
            'source' => StudySession::SOURCE_MICRO_LESSON,
        ], $this->csrfHeader($session))->assertStatus(201);

        $this->getJson('/api/v1/me/progress')
            ->assertOk()
            ->assertJsonPath('data.progress.totals.study_sessions', 1)
            ->assertJsonPath('data.progress.totals.study_seconds', 1200);
    }

    public function test_an_open_session_may_omit_the_end_time(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => now()->subMinutes(2)->toIso8601String(),
            'source' => StudySession::SOURCE_LESSON,
        ], $this->csrfHeader($session))
            ->assertStatus(201)
            ->assertJsonPath('data.study_session.ended_at', null)
            ->assertJsonPath('data.study_session.duration_sec', null);
    }
}
