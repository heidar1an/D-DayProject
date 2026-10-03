<?php

namespace Tests\Feature\Exam;

use App\Models\AnalyticsEvent;
use App\Models\ExamAttempt;
use App\Models\ExamResult;
use App\Services\Analytics\AnalyticsEventRecorder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فرمان‌های عملیاتی فاز ۷ و ۸.
 *
 * این دو فرمان در production اجرا می‌شوند، پس باید قابل‌اعتماد و **idempotent**
 * باشند. `--dry-run` هم قرارداد پروژه است: هیچ حذف/تغییری بدون اجرای صریح.
 */
class ExamCommandsTest extends TestCase
{
    use BuildsExams, BuildsQuestionBank, RefreshDatabase;

    // ── exam:expire-attempts ────────────────────────────────────────────

    public function test_it_closes_an_attempt_whose_grace_window_has_passed(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 0]);
        $this->moveDeadlineIntoThePast($context['attemptId'], 5);

        $this->artisan('exam:expire-attempts')->assertSuccessful();

        $attempt = ExamAttempt::query()->findOrFail($context['attemptId']);

        $this->assertSame(ExamAttempt::STATUS_EXPIRED, $attempt->status);
        $this->assertSame(ExamAttempt::REASON_TIMEOUT, $attempt->submit_reason);
        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    public function test_it_is_idempotent_across_runs(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 0]);
        $this->moveDeadlineIntoThePast($context['attemptId'], 5);

        $this->artisan('exam:expire-attempts')->assertSuccessful();

        $gradedAt = ExamResult::query()->where('attempt_id', $context['attemptId'])->value('graded_at');

        $this->artisan('exam:expire-attempts')->assertSuccessful();
        $this->artisan('exam:expire-attempts')->assertSuccessful();

        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
        $this->assertSame(
            (string) $gradedAt,
            (string) ExamResult::query()->where('attempt_id', $context['attemptId'])->value('graded_at'),
        );
    }

    public function test_dry_run_changes_nothing(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 0]);
        $this->moveDeadlineIntoThePast($context['attemptId'], 5);

        $this->artisan('exam:expire-attempts', ['--dry-run' => true])->assertSuccessful();

        $attempt = ExamAttempt::query()->findOrFail($context['attemptId']);

        $this->assertSame(ExamAttempt::STATUS_IN_PROGRESS, $attempt->status);
        $this->assertSame(0, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    public function test_it_leaves_an_attempt_inside_the_grace_window_open(): void
    {
        $context = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 600]);
        $this->moveDeadlineIntoThePast($context['attemptId'], 1);

        $this->artisan('exam:expire-attempts')->assertSuccessful();

        $attempt = ExamAttempt::query()->findOrFail($context['attemptId']);

        $this->assertSame(ExamAttempt::STATUS_IN_PROGRESS, $attempt->status, 'کاربر هنوز در گریس است.');
        $this->assertSame(0, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
    }

    public function test_it_rejects_an_unknown_exam_reference(): void
    {
        $this->artisan('exam:expire-attempts', ['--exam' => 'not-a-real-exam'])->assertFailed();
    }

    public function test_it_can_be_scoped_to_a_single_exam(): void
    {
        $first = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 0], ['phone' => '09125000011']);
        $second = $this->openAttempt(2, ['duration_minutes' => 1, 'grace_seconds' => 0], ['phone' => '09125000012']);

        $this->moveDeadlineIntoThePast($first['attemptId'], 5);
        $this->moveDeadlineIntoThePast($second['attemptId'], 5);

        $this->artisan('exam:expire-attempts', ['--exam' => $first['exam']->getKey()])->assertSuccessful();

        $this->assertSame(
            ExamAttempt::STATUS_EXPIRED,
            ExamAttempt::query()->findOrFail($first['attemptId'])->status,
        );
        $this->assertSame(
            ExamAttempt::STATUS_IN_PROGRESS,
            ExamAttempt::query()->findOrFail($second['attemptId'])->status,
        );
    }

    // ── analytics:prune-events ──────────────────────────────────────────

    public function test_pruning_is_dry_run_by_default_and_never_touches_domain_tables(): void
    {
        $context = $this->openAttempt(2);
        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$context['attemptId'].'/finish', [], $context['csrf'])->assertOk();

        $this->ageAllEvents(500);

        $before = AnalyticsEvent::query()->count();
        $this->assertGreaterThan(0, $before);

        $this->artisan('analytics:prune-events')->assertSuccessful();

        $this->assertSame($before, AnalyticsEvent::query()->count(), 'پیش‌فرض باید dry-run باشد.');

        /* و هیچ جدول دامنه‌ای دست نخورده است. */
        $this->assertSame(1, ExamResult::query()->where('attempt_id', $context['attemptId'])->count());
        $this->assertSame(1, ExamAttempt::query()->count());
    }

    public function test_applying_the_prune_removes_only_old_events(): void
    {
        $userId = $this->signedInStudent(['phone' => '09125000001'])['user']->getKey();
        $recorder = app(AnalyticsEventRecorder::class);

        $recorder->record('probe:old', 'exam_started', $userId, ['exam_id' => 'x'], Carbon::now()->subDays(400));
        $recorder->record('probe:fresh', 'exam_started', $userId, ['exam_id' => 'y'], Carbon::now());

        $this->artisan('analytics:prune-events', ['--apply' => true, '--days' => 30])->assertSuccessful();

        $keys = AnalyticsEvent::query()->pluck('event_key')->all();

        $this->assertSame(['probe:fresh'], $keys);
    }

    public function test_pruning_keeps_events_inside_the_retention_window(): void
    {
        $userId = $this->signedInStudent(['phone' => '09125000002'])['user']->getKey();
        $recorder = app(AnalyticsEventRecorder::class);

        $recorder->record('probe:inside', 'exam_started', $userId, ['exam_id' => 'x'], Carbon::now()->subDays(5));

        $this->artisan('analytics:prune-events', ['--apply' => true, '--days' => 30])->assertSuccessful();

        $this->assertSame(1, AnalyticsEvent::query()->count());
    }

    public function test_pruning_rejects_a_zero_retention_window(): void
    {
        $this->artisan('analytics:prune-events', ['--apply' => true, '--days' => 0])->assertFailed();
    }

    // ── کمکی ────────────────────────────────────────────────────────────

    private function moveDeadlineIntoThePast(string $attemptId, int $minutes): void
    {
        ExamAttempt::query()->whereKey($attemptId)->update([
            'started_at' => Carbon::now()->subMinutes($minutes + 30),
            'deadline_at' => Carbon::now()->subMinutes($minutes),
        ]);
    }

    private function ageAllEvents(int $days): void
    {
        AnalyticsEvent::query()->update(['occurred_at' => Carbon::now()->subDays($days)]);
    }
}
