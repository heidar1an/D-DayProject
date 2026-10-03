<?php

namespace Tests\Feature\Learning;

use App\Events\Learning\LessonCompleted;
use App\Events\Learning\ProgressUpdated;
use App\Models\LearningProgress;
use App\Models\Lesson;
use App\Models\LessonPage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۵ — پیشرفت یادگیری.
 *
 * تمرکز تست‌ها روی سه چیز است که واقعاً می‌توانند بشکنند:
 *   ۱. مالکیت (هر کاربر فقط رکورد خودش)؛
 *   ۲. قابلیت مشاهده (صفحهٔ غیرمنتشر ۴۰۴، نه ۴۰۳)؛
 *   ۳. یکپارچگی عددی (version، seconds، idempotency).
 */
class ProgressTest extends TestCase
{
    use BuildsQuestionBank, RefreshDatabase;

    public function test_reading_progress_requires_authentication(): void
    {
        $this->getJson('/api/v1/me/progress')->assertStatus(401);
    }

    public function test_updating_progress_requires_authentication(): void
    {
        $page = $this->makePublishedPage();

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
        ])->assertStatus(401);
    }

    public function test_a_fresh_page_reports_a_virtual_not_started_record(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->getJson('/api/v1/me/progress/pages/'.$page->getKey())
            ->assertOk()
            ->assertJsonPath('data.progress.id', null)
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_NOT_STARTED)
            ->assertJsonPath('data.progress.version', 0)
            ->assertJsonPath('data.progress.seconds_spent', 0)
            ->assertJsonPath('data.progress.completed_at', null);
    }

    public function test_it_creates_a_progress_record_for_a_published_page(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $response = $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'lastPosition' => 120,
            'completed' => false,
            'secondsSpent' => 30,
        ], $this->csrfHeader($session));

        $response->assertOk()
            ->assertJsonPath('data.progress.version', 1)
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_IN_PROGRESS)
            ->assertJsonPath('data.progress.seconds_spent', 30)
            ->assertJsonPath('data.progress.last_position', 120);

        $this->assertSame(1, LearningProgress::query()->count());
    }

    public function test_it_marks_a_page_completed_and_stamps_the_time(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'completed' => true,
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_COMPLETED);

        $progress = LearningProgress::query()->firstOrFail();

        $this->assertNotNull($progress->completed_at);
        $this->assertTrue($progress->isCompleted());
    }

    public function test_completion_is_sticky_and_does_not_revert(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'completed' => true,
        ], $this->csrfHeader($session))->assertOk();

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 1,
            'completed' => false,
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_COMPLETED);

        $this->assertTrue(LearningProgress::query()->firstOrFail()->isCompleted());
    }

    public function test_sequential_updates_accumulate_seconds_as_a_delta(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => 30,
        ], $this->csrfHeader($session))->assertOk();

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 1,
            'secondsSpent' => 45,
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.progress.seconds_spent', 75)
            ->assertJsonPath('data.progress.version', 2);
    }

    public function test_the_same_idempotency_key_does_not_double_count_seconds(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $headers = $this->csrfHeader($session);
        $headers['Idempotency-Key'] = 'progress-retry-1';

        $payload = ['version' => 0, 'secondsSpent' => 30, 'lastPosition' => 10];

        $first = $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), $payload, $headers);
        $second = $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), $payload, $headers);

        $first->assertOk();
        $second->assertOk();

        $this->assertSame($first->json('data.progress.id'), $second->json('data.progress.id'));
        $this->assertSame(1, LearningProgress::query()->count());
        $this->assertSame(30, LearningProgress::query()->firstOrFail()->seconds_spent);
        $this->assertSame(1, (int) LearningProgress::query()->firstOrFail()->version);
    }

    public function test_the_same_idempotency_key_with_a_different_payload_is_a_conflict(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $headers = $this->csrfHeader($session);
        $headers['Idempotency-Key'] = 'progress-retry-2';

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => 10,
        ], $headers)->assertOk();

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => 99,
        ], $headers)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'IDEMPOTENCY_KEY_REUSED');
    }

    public function test_a_stale_version_is_rejected_with_409(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => 5,
        ], $this->csrfHeader($session))->assertOk();

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => 5,
        ], $this->csrfHeader($session))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'VERSION_CONFLICT');

        $this->assertSame(5, LearningProgress::query()->firstOrFail()->seconds_spent);
    }

    public function test_an_unknown_lesson_page_is_404(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->getJson('/api/v1/me/progress/pages/'.Str::uuid())
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_a_page_under_a_draft_lesson_is_404_not_403(): void
    {
        $page = $this->makePageUnderDraftLesson();
        $session = $this->register();
        $this->withAuthCookies($session);

        // ۴۰۴ نه ۴۰۳: وجود پیش‌نویس نباید از رفتار پاسخ لو برود.
        $this->getJson('/api/v1/me/progress/pages/'.$page->getKey())->assertStatus(404);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
        ], $this->csrfHeader($session))->assertStatus(404);

        $this->assertSame(0, LearningProgress::query()->count());
    }

    public function test_a_draft_page_is_404(): void
    {
        $page = $this->makeDraftPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->getJson('/api/v1/me/progress/pages/'.$page->getKey())->assertStatus(404);
    }

    public function test_seconds_above_the_configured_ceiling_are_rejected(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $max = (int) config('learning.progress.max_seconds_per_update');

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => $max + 1,
        ], $this->csrfHeader($session))->assertStatus(422);

        $this->assertSame(0, LearningProgress::query()->count());
    }

    public function test_a_negative_seconds_value_is_rejected(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => -1,
        ], $this->csrfHeader($session))->assertStatus(422);
    }

    public function test_version_is_required(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'secondsSpent' => 10,
        ], $this->csrfHeader($session))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertFieldError('version');
    }

    public function test_last_position_is_not_monotonic_and_out_of_range_is_rejected(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $max = (int) config('learning.progress.max_position');

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'lastPosition' => 900,
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.progress.last_position', 900);

        // بازگشت به عقب مجاز است — `last_position` یکنوا نیست.
        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 1,
            'lastPosition' => 10,
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.progress.last_position', 10);

        // خارج از بازهٔ مجاز ⇒ ۴۲۲ صریح، نه clamp بی‌صدا.
        // (clamp در سرویس به‌عنوان لایهٔ دفاعی دوم می‌ماند، ولی از مسیر API
        //  قابل‌دسترس نیست — و این عمدی است: کلاینت خراب باید بفهمد.)
        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 2,
            'lastPosition' => $max + 1,
        ], $this->csrfHeader($session))->assertStatus(422);

        $this->assertSame(10, (int) LearningProgress::query()->firstOrFail()->last_position);
    }

    public function test_one_user_cannot_read_or_affect_another_users_progress(): void
    {
        $page = $this->makePublishedPage();

        $first = $this->register();
        $this->withAuthCookies($first);
        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => 120,
            'completed' => true,
        ], $this->csrfHeader($first))->assertOk();

        $second = $this->register(['phone' => '09120000002']);
        $this->withAuthCookies($second);

        // کاربر دوم همان صفحه را «شروع‌نشده» می‌بیند، نه پیشرفت کاربر اول.
        $this->getJson('/api/v1/me/progress/pages/'.$page->getKey())
            ->assertOk()
            ->assertJsonPath('data.progress.version', 0)
            ->assertJsonPath('data.progress.seconds_spent', 0)
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_NOT_STARTED);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'secondsSpent' => 7,
        ], $this->csrfHeader($second))->assertOk();

        $this->assertSame(2, LearningProgress::query()->count());

        $seconds = LearningProgress::query()->pluck('seconds_spent')->sort()->values()->all();

        $this->assertSame([7, 120], $seconds);
    }

    public function test_a_user_id_in_the_body_has_no_effect(): void
    {
        $page = $this->makePublishedPage();
        $victim = User::factory()->create();

        $session = $this->register();
        $this->withAuthCookies($session);
        $me = $this->getJson('/api/v1/me')->json('data.user.id');

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'userId' => $victim->getKey(),
            'user_id' => $victim->getKey(),
            'secondsSpent' => 12,
        ], $this->csrfHeader($session))->assertOk();

        $progress = LearningProgress::query()->firstOrFail();

        $this->assertSame($me, $progress->user_id);
        $this->assertNotSame($victim->getKey(), $progress->user_id);
    }

    public function test_internal_fields_sent_in_the_body_are_ignored(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'status' => LearningProgress::STATUS_COMPLETED,
            'completedAt' => now()->toIso8601String(),
            'lesson_page_id' => Str::uuid(),
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_IN_PROGRESS)
            ->assertJsonPath('data.progress.completed_at', null);

        $progress = LearningProgress::query()->firstOrFail();

        $this->assertSame($page->getKey(), $progress->lesson_page_id);
        $this->assertFalse($progress->isCompleted());
    }

    public function test_the_payload_never_exposes_the_owner_id(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $response = $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
        ], $this->csrfHeader($session));

        $this->assertStringNotContainsString('user_id', $response->getContent());
    }

    public function test_the_summary_is_derived_from_source_records(): void
    {
        $tree = $this->makeContentTree();

        $otherPages = [
            LessonPage::factory()->published()->forLesson($tree['lesson'])->create(),
            LessonPage::factory()->published()->forLesson($tree['lesson'])->create(),
        ];

        $session = $this->register();
        $this->withAuthCookies($session);

        $pages = array_merge([$tree['page']], $otherPages);

        foreach ($pages as $index => $page) {
            $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
                'version' => 0,
                'secondsSpent' => 60,
                'completed' => $index < 2,
            ], $this->csrfHeader($session))->assertOk();
        }

        $this->getJson('/api/v1/me/progress')
            ->assertOk()
            ->assertJsonPath('data.progress.totals.tracked_pages', 3)
            ->assertJsonPath('data.progress.totals.completed_pages', 2)
            ->assertJsonPath('data.progress.totals.seconds_spent', 180)
            ->assertJsonPath('data.progress.courses.0.total_pages', 3)
            ->assertJsonPath('data.progress.courses.0.percent', 67);
    }

    public function test_the_summary_ignores_pages_that_are_not_visible(): void
    {
        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'completed' => true,
        ], $this->csrfHeader($session))->assertOk();

        // درس از انتشار خارج می‌شود ⇒ مخرج کسر نباید صفحهٔ نامرئی را بشمارد.
        Lesson::query()->whereKey($page->lesson_id)->update(['status' => 'draft']);

        $summary = $this->getJson('/api/v1/me/progress')->assertOk()->json('data.progress');

        $this->assertSame(1, $summary['totals']['completed_pages']);
        $this->assertSame(0, $summary['courses'][0]['total_pages']);
        $this->assertSame(0, $summary['courses'][0]['percent']);
    }

    public function test_it_dispatches_progress_and_completion_events(): void
    {
        Event::fake([ProgressUpdated::class, LessonCompleted::class]);

        $page = $this->makePublishedPage();
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page->getKey(), [
            'version' => 0,
            'completed' => true,
        ], $this->csrfHeader($session))->assertOk();

        Event::assertDispatched(ProgressUpdated::class);
        Event::assertDispatched(LessonCompleted::class);
    }
}
