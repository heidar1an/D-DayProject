<?php

namespace Tests\Feature\Outbox;

use App\Events\Exam\ExamFinished;
use App\Events\GreenPath\GreenPathStepCompleted;
use App\Jobs\ProcessOutboxEventJob;
use App\Listeners\Gamification\ProcessActivity;
use App\Listeners\Notifications\QueueExamResultNotification;
use App\Models\Notification;
use App\Models\OutboxEvent;
use App\Models\User;
use App\Services\Outbox\OutboxPublisher;
use App\Services\Outbox\OutboxService;
use Database\Seeders\AchievementSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Tests\Concerns\BuildsOps;
use Tests\TestCase;

/**
 * Outbox — فاز ۱۹ (§11–§13/§40/§117).
 *
 * تمرکز: idempotency کلید رخداد، duplicate-safety انتشار، و اینکه نوع ناشناخته
 * **بی‌صدا گم نمی‌شود** (Job fail می‌کند و در dead-letter دیده می‌شود).
 */
final class OutboxTest extends TestCase
{
    use BuildsOps, RefreshDatabase;

    private function outbox(): OutboxService
    {
        return app(OutboxService::class);
    }

    public function test_recording_the_same_event_key_twice_creates_one_row(): void
    {
        $first = $this->outbox()->record('k:1', 'article', 'a-1', 'search.index', ['entityType' => 'article', 'entityId' => 'a-1'], dispatch: false);
        $second = $this->outbox()->record('k:1', 'article', 'a-1', 'search.index', ['entityType' => 'article', 'entityId' => 'a-1'], dispatch: false);

        self::assertInstanceOf(OutboxEvent::class, $first);
        self::assertNull($second);
        self::assertSame(1, OutboxEvent::query()->count());
    }

    public function test_an_unknown_event_type_is_rejected_at_write_time(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->outbox()->record('k:2', 'article', 'a-1', 'made_up.type', [], dispatch: false);
    }

    public function test_an_oversized_payload_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->outbox()->record('k:3', 'article', 'a-1', 'search.index', [
            'entityType' => 'article',
            'entityId' => 'a-1',
            'blob' => Str::repeat('x', (int) config('outbox.payload_max_bytes') + 100),
        ], dispatch: false);
    }

    public function test_publishing_dispatches_a_job_for_each_pending_event(): void
    {
        Queue::fake();

        $this->outbox()->record('k:4', 'article', 'a-1', 'search.index', ['entityType' => 'article', 'entityId' => 'a-1'], dispatch: false);
        $this->outbox()->record('k:5', 'article', 'a-2', 'search.remove', ['entityType' => 'article', 'entityId' => 'a-2'], dispatch: false);

        Queue::assertNothingPushed();

        $queued = app(OutboxPublisher::class)->sweep((int) config('outbox.sweep.batch'));

        self::assertSame(2, $queued);
        Queue::assertPushed(ProcessOutboxEventJob::class, 2);
    }

    public function test_publishing_is_idempotent_and_marks_the_event(): void
    {
        $article = $this->makeArticle(['title' => 'کلیه']);
        $event = $this->outbox()->record(
            'k:6',
            'article',
            (string) $article->getKey(),
            'search.index',
            ['entityType' => 'article', 'entityId' => (string) $article->getKey()],
            dispatch: false,
        );

        self::assertInstanceOf(OutboxEvent::class, $event);

        $publisher = app(OutboxPublisher::class);

        self::assertSame('published', $publisher->process((string) $event->getKey()));
        self::assertSame('already_published', $publisher->process((string) $event->getKey()));
        self::assertNotNull($event->refresh()->published_at);

        /* Side effect فقط یک بار اجرا شد. */
        self::assertSame(1, DB::table('search_documents')->where('entity_id', $article->getKey())->count());
    }

    public function test_an_event_whose_handler_is_missing_fails_visibly(): void
    {
        $event = new OutboxEvent;
        $event->forceFill([
            'event_key' => 'k:7',
            'aggregate_type' => 'article',
            'aggregate_id' => 'a-1',
            'event_type' => 'legacy.unknown',
            'payload' => [],
            'attempts' => 0,
        ])->save();

        try {
            app(OutboxPublisher::class)->process((string) $event->getKey());
            self::fail('an unknown event type must not be swallowed');
        } catch (\RuntimeException) {
            /* انتظار می‌رود: Job fail می‌شود تا در dead-letter دیده شود. */
        }

        $event->refresh();

        self::assertSame('UNKNOWN_EVENT_TYPE', (string) $event->last_error_code);
        self::assertSame(1, (int) $event->attempts);
        self::assertNull($event->published_at);
    }

    public function test_a_missing_event_id_is_a_no_op(): void
    {
        self::assertSame('missing', app(OutboxPublisher::class)->process((string) Str::uuid()));
    }

    public function test_a_notification_event_becomes_exactly_one_notification(): void
    {
        $session = $this->register(['phone' => '09121000001']);
        $user = User::query()->where('phone', '09121000001')->firstOrFail();

        $event = $this->outbox()->record(
            'notification.system:'.$user->getKey(),
            'user',
            (string) $user->getKey(),
            'notification.system',
            ['userId' => (string) $user->getKey(), 'title' => 'خوش آمدی'],
            dispatch: false,
        );

        self::assertInstanceOf(OutboxEvent::class, $event);

        $publisher = app(OutboxPublisher::class);
        $publisher->process((string) $event->getKey());
        $publisher->process((string) $event->getKey());

        self::assertSame(1, Notification::query()->where('user_id', $user->getKey())->count());

        $this->withAuthCookies($session)
            ->getJson('/api/v1/me/notifications')
            ->assertOk()
            ->assertJsonPath('data.notifications.0.title', 'خوش آمدی');
    }

    public function test_a_notification_event_without_a_user_is_rejected(): void
    {
        $event = $this->outbox()->record('k:8', 'user', 'u-1', 'notification.system', ['title' => 'بی‌مخاطب'], dispatch: false);

        self::assertInstanceOf(OutboxEvent::class, $event);

        $this->expectException(InvalidArgumentException::class);

        app(OutboxPublisher::class)->process((string) $event->getKey());
    }

    public function test_search_remove_deletes_the_index_row(): void
    {
        $article = $this->makeArticle(['title' => 'کلیه']);
        $this->indexDocument('article', (string) $article->getKey());

        self::assertSame(1, DB::table('search_documents')->where('entity_id', $article->getKey())->count());

        $event = $this->outbox()->record(
            'search.remove:'.$article->getKey(),
            'article',
            (string) $article->getKey(),
            'search.remove',
            ['entityType' => 'article', 'entityId' => (string) $article->getKey()],
            dispatch: false,
        );

        self::assertInstanceOf(OutboxEvent::class, $event);

        app(OutboxPublisher::class)->process((string) $event->getKey());

        self::assertSame(0, DB::table('search_documents')->where('entity_id', $article->getKey())->count());
    }

    public function test_an_index_event_on_unpublished_content_removes_the_document(): void
    {
        $article = $this->makeArticle(['title' => 'کلیه']);
        $this->indexDocument('article', (string) $article->getKey());

        $article->forceFill(['status' => 'draft'])->save();

        $event = $this->outbox()->record(
            'search.index:'.$article->getKey(),
            'article',
            (string) $article->getKey(),
            'search.index',
            ['entityType' => 'article', 'entityId' => (string) $article->getKey()],
            dispatch: false,
        );

        self::assertInstanceOf(OutboxEvent::class, $event);

        app(OutboxPublisher::class)->process((string) $event->getKey());

        self::assertSame(0, DB::table('search_documents')->where('entity_id', $article->getKey())->count());
    }

    public function test_the_exam_finished_listener_records_one_outbox_event(): void
    {
        $user = $this->makeStudent('09121000002');
        $listener = app(QueueExamResultNotification::class);

        $event = new ExamFinished(
            examId: (string) Str::uuid(),
            attemptId: 'attempt-1',
            userId: (string) $user->getKey(),
            status: 'submitted',
            submitReason: 'manual',
            resultId: (string) Str::uuid(),
        );

        $listener->handle($event);
        $listener->handle($event);

        self::assertSame(1, OutboxEvent::query()->where('event_type', 'notification.exam_result')->count());

        /* و انتشار آن یک اعلان می‌سازد. */
        $row = OutboxEvent::query()->where('event_type', 'notification.exam_result')->firstOrFail();
        app(OutboxPublisher::class)->process((string) $row->getKey());

        self::assertSame(1, Notification::query()->where('user_id', $user->getKey())->where('type', Notification::TYPE_EXAM_RESULT)->count());
    }

    public function test_the_exam_listener_ignores_a_guest_attempt(): void
    {
        app(QueueExamResultNotification::class)->handle(new ExamFinished(
            examId: (string) Str::uuid(),
            attemptId: 'attempt-2',
            userId: null,
            status: 'submitted',
            submitReason: 'manual',
            resultId: (string) Str::uuid(),
        ));

        self::assertSame(0, OutboxEvent::query()->count());
    }

    public function test_an_unlocked_achievement_records_a_notification_event(): void
    {
        $this->seed(AchievementSeeder::class);

        $user = $this->makeStudent('09121000003');
        $userId = (string) $user->getKey();

        $pathId = (string) Str::uuid();
        DB::table('green_paths')->insert([
            'id' => $pathId,
            'user_id' => $userId,
            'goal_key' => 'exam-ready',
            'plan_version' => 1,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $stepId = (string) Str::uuid();
        DB::table('green_path_steps')->insert([
            'id' => $stepId,
            'path_id' => $pathId,
            'kind' => 'action',
            'position' => 1,
            'status' => 'completed',
            'source' => 'plan',
            'version' => 1,
            /* ناوردایی فاز ۱۳–۱۴: status='completed' ⟷ completed_at پرشده. */
            'completed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $listener = app(ProcessActivity::class);
        $listener->handle(new GreenPathStepCompleted($userId, $stepId, 'action'));
        $listener->handle(new GreenPathStepCompleted($userId, $stepId, 'action'));

        $events = OutboxEvent::query()->where('event_type', 'notification.achievement_unlocked')->get();

        self::assertCount(1, $events, 'achievement unlock must be recorded exactly once');

        app(OutboxPublisher::class)->process((string) $events->first()->getKey());

        self::assertSame(1, Notification::query()->where('user_id', $userId)->where('type', Notification::TYPE_ACHIEVEMENT_UNLOCKED)->count());
    }

    public function test_prune_removes_only_published_and_old_events(): void
    {
        $old = $this->outbox()->record('k:9', 'article', 'a-1', 'search.index', ['entityType' => 'article', 'entityId' => 'a-1'], dispatch: false);
        $pending = $this->outbox()->record('k:10', 'article', 'a-2', 'search.index', ['entityType' => 'article', 'entityId' => 'a-2'], dispatch: false);

        self::assertInstanceOf(OutboxEvent::class, $old);
        self::assertInstanceOf(OutboxEvent::class, $pending);

        OutboxEvent::query()->whereKey($old->getKey())->update([
            'published_at' => now()->subDays(40),
            'updated_at' => now()->subDays(40),
        ]);

        $removed = app(OutboxPublisher::class)->prune(14);

        self::assertSame(1, $removed);
        self::assertNull(OutboxEvent::query()->find($old->getKey()));
        self::assertNotNull(OutboxEvent::query()->find($pending->getKey()));
    }

    public function test_the_outbox_command_is_a_safe_no_op_when_disabled(): void
    {
        config()->set('outbox.sweep.enabled', false);

        $this->artisan('outbox:publish')->assertSuccessful();
    }
}
