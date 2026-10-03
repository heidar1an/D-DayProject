<?php

namespace Tests\Feature\GreenPath;

use App\Models\GreenPath;
use App\Models\GreenPathStep;
use App\Models\Lesson;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۱۳ — API مسیر سبز.
 *
 * تمرکز روی چیزهایی که واقعاً می‌توانند بشکنند:
 *   ۱. مالکیت (قدمِ کاربر دیگر ۴۰۴)؛
 *   ۲. گذارهای وضعیت (کلاینت هرگز قدم محتوایی را completed نمی‌کند)؛
 *   ۳. optimistic lock و idempotency؛
 *   ۴. کراندار بودن تقویم.
 */
class GreenPathApiTest extends TestCase
{
    use BuildsQuestionBank, RefreshDatabase;

    /* ───────────────────────── احراز هویت ───────────────────────── */

    public function test_green_path_endpoints_require_authentication(): void
    {
        foreach (['profile', 'roadmap', 'today', 'calendar', 'performance'] as $segment) {
            $this->getJson("/api/v1/me/green-path/{$segment}")->assertStatus(401);
        }

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.Str::uuid(), [
            'status' => 'in_progress',
            'version' => 1,
        ])->assertStatus(401);
    }

    /* ───────────────────────── roadmap خودکار ───────────────────────── */

    public function test_roadmap_builds_a_path_from_published_content(): void
    {
        $lesson = $this->makePublishedLesson();
        $session = $this->register();
        $this->withAuthCookies($session);

        $response = $this->getJson('/api/v1/me/green-path/roadmap')->assertOk();

        $response->assertJsonPath('data.path.status', GreenPath::STATUS_ACTIVE)
            ->assertJsonPath('data.progress.total_steps', 1);

        $step = GreenPathStep::query()->sole();
        $this->assertSame(GreenPathStep::KIND_LESSON, $step->kind);
        $this->assertSame($lesson->getKey(), $step->lesson_id);
        $this->assertSame(GreenPathStep::STATUS_RECOMMENDED, $step->status);

        /* مسیر دوم ساخته نمی‌شود — همان مسیر برمی‌گردد. */
        $this->getJson('/api/v1/me/green-path/roadmap')->assertOk();
        $this->assertSame(1, GreenPath::query()->count());
    }

    public function test_roadmap_has_no_steps_without_real_content(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->getJson('/api/v1/me/green-path/roadmap')
            ->assertOk()
            ->assertJsonPath('data.progress.total_steps', 0)
            ->assertJsonPath('data.current_step', null);
    }

    public function test_profile_reports_real_identity_only(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->getJson('/api/v1/me/green-path/profile')
            ->assertOk()
            ->assertJsonPath('data.profile.goal_key', 'semester-excellence')
            ->assertJsonPath('data.profile.plan_version', 1);
    }

    /* ───────────────────────── تقویم ───────────────────────── */

    public function test_calendar_validates_range_and_is_bounded(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->getJson('/api/v1/me/green-path/calendar?from=2026-01-10&to=2026-01-01')
            ->assertStatus(422)
            ->assertFieldError('to');

        $longTo = now()->addDays(120)->toDateString();
        $this->getJson('/api/v1/me/green-path/calendar?from='.now()->toDateString().'&to='.$longTo)
            ->assertStatus(422)
            ->assertFieldError('to');

        $this->getJson('/api/v1/me/green-path/calendar?from=not-a-date')->assertStatus(422);

        $this->getJson('/api/v1/me/green-path/calendar')->assertOk();
    }

    public function test_today_uses_server_date(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $response = $this->getJson('/api/v1/me/green-path/today')->assertOk();

        $this->assertSame(now()->toDateString(), $response->json('data.date'));
    }

    /* ───────────────────────── گذار وضعیت ───────────────────────── */

    public function test_user_can_start_the_recommended_step(): void
    {
        $this->makePublishedLesson();
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();
        $step = GreenPathStep::query()->sole();

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$step->getKey(), [
            'status' => 'in_progress',
            'version' => 1,
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.step.status', GreenPathStep::STATUS_IN_PROGRESS)
            ->assertJsonPath('data.step.version', 2);
    }

    public function test_locked_step_cannot_be_started_or_completed(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();

        /* قدم قفل: با دست‌ساز — هیچ محتوایی در پنجرهٔ باز نیست. */
        $path = GreenPath::query()->sole();
        $locked = (new GreenPathStep)->forceFill(['path_id' => $path->getKey(), 
            'kind' => GreenPathStep::KIND_ACTION,
            'lesson_id' => null,
            'question_id' => null,
            'exam_id' => null,
            'position' => 1,
            'status' => GreenPathStep::STATUS_LOCKED,
            'version' => 1,
        ]);
        $locked->save();

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$locked->getKey(), [
            'status' => 'in_progress',
            'version' => 1,
        ], $this->csrfHeader($session))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INVALID_TRANSITION');

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$locked->getKey(), [
            'status' => 'completed',
            'version' => 1,
        ], $this->csrfHeader($session))
            ->assertStatus(409);
    }

    public function test_content_step_cannot_be_completed_by_client(): void
    {
        $this->makePublishedLesson();
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();
        $step = GreenPathStep::query()->sole();

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$step->getKey(), [
            'status' => 'in_progress',
            'version' => 1,
        ], $this->csrfHeader($session))->assertOk();

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$step->getKey(), [
            'status' => 'completed',
            'version' => 2,
        ], $this->csrfHeader($session))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INVALID_TRANSITION');

        $this->assertNotSame(GreenPathStep::STATUS_COMPLETED, $step->refresh()->status);
    }

    public function test_action_step_can_be_completed_by_client(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();

        $path = GreenPath::query()->sole();
        $action = (new GreenPathStep)->forceFill(['path_id' => $path->getKey(), 
            'kind' => GreenPathStep::KIND_ACTION,
            'position' => 1,
            'status' => GreenPathStep::STATUS_AVAILABLE,
            'version' => 1,
        ]);
        $action->save();

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$action->getKey(), [
            'status' => 'in_progress',
            'version' => 1,
        ], $this->csrfHeader($session))->assertOk();

        $response = $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$action->getKey(), [
            'status' => 'completed',
            'version' => 2,
        ], $this->csrfHeader($session))->assertOk();

        $response->assertJsonPath('data.step.status', GreenPathStep::STATUS_COMPLETED);

        $this->assertSame(GreenPathStep::STATUS_COMPLETED, $action->refresh()->status);
        $this->assertNotNull($action->completed_at);
    }

    public function test_stale_version_returns_conflict(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();

        $path = GreenPath::query()->sole();
        $action = (new GreenPathStep)->forceFill(['path_id' => $path->getKey(), 
            'kind' => GreenPathStep::KIND_ACTION,
            'position' => 1,
            'status' => GreenPathStep::STATUS_AVAILABLE,
            'version' => 3,
        ]);
        $action->save();

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$action->getKey(), [
            'status' => 'in_progress',
            'version' => 2,
        ], $this->csrfHeader($session))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'VERSION_CONFLICT');
    }

    public function test_unknown_status_is_rejected(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();

        $path = GreenPath::query()->sole();
        $action = (new GreenPathStep)->forceFill(['path_id' => $path->getKey(), 
            'kind' => GreenPathStep::KIND_ACTION,
            'position' => 1,
            'status' => GreenPathStep::STATUS_AVAILABLE,
            'version' => 1,
        ]);
        $action->save();

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$action->getKey(), [
            'status' => 'expired',
            'version' => 1,
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertFieldError('status');
    }

    /* ───────────────────────── مالکیت و امنیت ───────────────────────── */

    public function test_a_user_cannot_patch_or_see_another_users_step(): void
    {
        $this->makePublishedLesson();

        $owner = $this->register();
        $this->withAuthCookies($owner);
        $this->bootstrapPath();
        $step = GreenPathStep::query()->sole();

        $intruder = $this->register(['phone' => '09120000001']);
        $this->withAuthCookies($intruder)->forgetCookies()->withAuthCookies($intruder);

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$step->getKey(), [
            'status' => 'in_progress',
            'version' => 1,
        ], $this->csrfHeader($intruder))->assertStatus(404);

        /* قدمِ مالک دست‌نخورده مانده. */
        $this->assertSame(GreenPathStep::STATUS_RECOMMENDED, $step->refresh()->status);
    }

    public function test_step_patch_ignores_mass_assignment_fields(): void
    {
        $this->makePublishedLesson();
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();
        $step = GreenPathStep::query()->sole();
        $originalDue = $step->due_at?->toIso8601String();

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$step->getKey(), [
            'status' => 'in_progress',
            'version' => 1,
            'user_id' => Str::uuid(),
            'path_id' => Str::uuid(),
            'due_at' => '2000-01-01T00:00:00Z',
            'completed_at' => '2000-01-01T00:00:00Z',
            'position' => 99,
        ], $this->csrfHeader($session))->assertOk();

        $step->refresh();
        $this->assertSame(GreenPathStep::STATUS_IN_PROGRESS, $step->status);
        $this->assertSame(2, $step->version);
        $this->assertSame($originalDue, $step->due_at?->toIso8601String());
        $this->assertNull($step->completed_at);
    }

    public function test_idempotency_key_replays_the_same_patch(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();

        $path = GreenPath::query()->sole();
        $action = (new GreenPathStep)->forceFill(['path_id' => $path->getKey(), 
            'kind' => GreenPathStep::KIND_ACTION,
            'position' => 1,
            'status' => GreenPathStep::STATUS_AVAILABLE,
            'version' => 1,
        ]);
        $action->save();

        $headers = $this->csrfHeader($session) + ['Idempotency-Key' => 'gp-test-1'];

        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$action->getKey(), [
            'status' => 'in_progress',
            'version' => 1,
        ], $headers)->assertOk();

        /* همان کلید + همان payload ⇒ replay، نه اجرای دوباره. */
        $this->patchJsonWithOrigin('/api/v1/me/green-path/steps/'.$action->getKey(), [
            'status' => 'in_progress',
            'version' => 1,
        ], $headers)->assertOk();

        /* replay پاسخ ذخیره‌شده است: version همچنان ۲ و دوباره بالا نرفته. */
        $this->assertSame(2, $action->refresh()->version);
    }

    /* ───────────────────────── عملکرد ───────────────────────── */

    public function test_performance_reports_real_metrics_only(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);
        $this->bootstrapPath();

        $path = GreenPath::query()->sole();
        (new GreenPathStep)->forceFill(['path_id' => $path->getKey(), 
            'kind' => GreenPathStep::KIND_ACTION,
            'position' => 1,
            'status' => GreenPathStep::STATUS_COMPLETED,
            'completed_at' => now(),
            'version' => 2,
        ])->save();

        $this->getJson('/api/v1/me/green-path/performance')
            ->assertOk()
            ->assertJsonPath('data.steps.total', 1)
            ->assertJsonPath('data.steps.completed', 1)
            ->assertJsonPath('data.steps.completion_rate', 100)
            ->assertJsonPath('data.study_time.sessions', 0)
            ->assertJsonPath('data.exams.taken', 0);
    }

    /* ───────────────────────── سازنده‌ها ───────────────────────── */

    /** مسیر فعال را با یک GET واقعی می‌سازد — ساخت مسیر تنبل است. */
    private function bootstrapPath(): void
    {
        $this->getJson('/api/v1/me/green-path/roadmap')->assertOk();
    }

    private function makePublishedLesson(): Lesson
    {
        return $this->makePublishedPage()->lesson;
    }
}
