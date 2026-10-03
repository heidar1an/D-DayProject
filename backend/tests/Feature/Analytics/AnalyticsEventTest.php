<?php

namespace Tests\Feature\Analytics;

use App\Exceptions\ApiErrorException;
use App\Models\AnalyticsEvent;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\Question;
use App\Services\Analytics\AnalyticsCache;
use App\Services\Analytics\AnalyticsEventRecorder;
use App\Services\Analytics\AnalyticsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * رویداد و کش Analytics — فاز ۸.
 *
 * دو چیز اینجا قفل می‌شود:
 *   • **رویدادها**: typed، dedup-safe، بدون PII، و بدون تکرار عدد دامنه.
 *     (`percentage` در رویداد نیست — منبع حقیقتش `exam_results` است.)
 *   • **کش**: per-user، version-aware، و باطل‌شده با رویداد واقعی دامنه.
 */
class AnalyticsEventTest extends TestCase
{
    use BuildsExams, BuildsQuestionBank, RefreshDatabase;

    // ── ثبت رویداد از رویداد دامنه ───────────────────────────────────────

    public function test_finishing_an_exam_records_start_and_finish_events(): void
    {
        $student = $this->signedInStudent(['phone' => '09124000001']);
        $built = $this->makeExam([], 2);
        $this->sitExamAs($student, $built, 2);

        $types = AnalyticsEvent::query()
            ->where('user_id', $student['user']->getKey())
            ->pluck('event_type')
            ->all();

        $this->assertContains('exam_started', $types);
        $this->assertContains('exam_finished', $types);
    }

    public function test_the_finished_event_carries_no_score(): void
    {
        $student = $this->signedInStudent(['phone' => '09124000002']);
        $built = $this->makeExam([], 2);
        $this->sitExamAs($student, $built, 2);

        $event = AnalyticsEvent::query()
            ->where('user_id', $student['user']->getKey())
            ->where('event_type', 'exam_finished')
            ->firstOrFail();

        $properties = $event->properties ?? [];

        /*
         * PostgreSQL کلیدهای `jsonb` را بازچینی می‌کند (ترتیب درج حفظ نمی‌شود)
         * ⇒ به‌جای ترتیب، **مجموعهٔ کلیدها** را می‌سنجیم. قدرت تست حفظ می‌شود:
         * هر کلید اضافی همین‌جا قرمز می‌کند.
         */
        $keys = array_keys($properties);
        sort($keys);

        $this->assertSame(['exam_id', 'reason', 'status'], $keys);
        $this->assertArrayNotHasKey('percentage', $properties);
        $this->assertArrayNotHasKey('score', $properties);
        $this->assertArrayNotHasKey('correct_count', $properties);
    }

    public function test_a_replayed_finish_does_not_duplicate_the_event(): void
    {
        $student = $this->signedInStudent(['phone' => '09124000003']);
        $built = $this->makeExam([], 2);

        $this->withAuthCookies($student['session']);

        $this->postJsonWithOrigin('/api/v1/exams/'.$built['exam']->getKey().'/registrations', [], $student['csrf'])
            ->assertStatus(201);

        $attemptId = $this->startAttempt($built['exam'], $student['csrf'])->assertStatus(201)->json('data.attempt.id');

        $finish = fn () => $this->postJsonWithOrigin(
            '/api/v1/exam-attempts/'.$attemptId.'/finish',
            [],
            $student['csrf'],
        )->assertOk();

        $finish();
        $finish();
        $finish();

        $this->assertSame(1, AnalyticsEvent::query()
            ->where('user_id', $student['user']->getKey())
            ->where('event_type', 'exam_finished')
            ->count());

        $this->assertSame(1, AnalyticsEvent::query()
            ->where('user_id', $student['user']->getKey())
            ->where('event_type', 'exam_started')
            ->count());

        $this->assertSame(
            'exam.finished:'.$attemptId,
            AnalyticsEvent::query()
                ->where('user_id', $student['user']->getKey())
                ->where('event_type', 'exam_finished')
                ->value('event_key'),
        );
    }

    public function test_progress_autosave_records_no_event_but_completion_records_one(): void
    {
        $student = $this->signedInStudent(['phone' => '09124000004']);
        $tree = $this->makeContentTree();

        $this->withAuthCookies($student['session']);

        /* دو autosave معمولی — نباید رویداد بسازند. */
        foreach ([10, 20] as $index => $seconds) {
            $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$tree['page']->getKey(), [
                'version' => $index,
                'completed' => false,
                'secondsSpent' => $seconds,
            ], $student['csrf'])->assertOk();
        }

        $this->assertSame(0, AnalyticsEvent::query()->where('user_id', $student['user']->getKey())->count());

        /* تکمیل صفحه — یک رویداد، فقط یکی. */
        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$tree['page']->getKey(), [
            'version' => 2,
            'completed' => true,
            'secondsSpent' => 30,
        ], $student['csrf'])->assertOk();

        $events = AnalyticsEvent::query()->where('user_id', $student['user']->getKey())->get();

        $this->assertCount(1, $events);
        $this->assertSame('lesson_completed', $events->first()->event_type);
    }

    public function test_answering_a_question_records_exactly_one_event(): void
    {
        $student = $this->signedInStudent(['phone' => '09124000005']);
        $built = $this->makeQuestion();
        $this->answerQuestion($student, $built['question']->getKey(), true);

        $events = AnalyticsEvent::query()->where('user_id', $student['user']->getKey())->get();

        $this->assertCount(1, $events);
        $this->assertSame('question_answered', $events->first()->event_type);

        /* `is_correct` در رویداد تکرار نمی‌شود — منبعش `question_attempts` است. */
        $this->assertArrayNotHasKey('is_correct', $events->first()->properties);
    }

    // ── قواعد ثبت‌کننده ──────────────────────────────────────────────────

    public function test_the_recorder_is_idempotent_by_event_key(): void
    {
        $recorder = app(AnalyticsEventRecorder::class);
        $userId = $this->signedInStudent(['phone' => '09124000006'])['user']->getKey();

        $first = $recorder->record('probe:1', 'exam_started', $userId, ['exam_id' => 'x']);
        $second = $recorder->record('probe:1', 'exam_started', $userId, ['exam_id' => 'x']);

        $this->assertTrue($first);
        $this->assertFalse($second, 'کلید تکراری نباید ردیف تازه بسازد.');
        $this->assertSame(1, $recorder->countFor($userId, 'exam_started'));
    }

    public function test_an_unknown_event_type_is_rejected(): void
    {
        $recorder = app(AnalyticsEventRecorder::class);

        try {
            $recorder->record('probe:2', 'made_up_event', null, []);
            $this->fail('نوع رویداد ناشناخته باید رد شود.');
        } catch (ApiErrorException $error) {
            $this->assertSame('VALIDATION_FAILED', $error->errorCode);
            $this->assertSame(['event_type' => ['UNKNOWN_EVENT_TYPE']], $error->fields);
        }
    }

    public function test_forbidden_property_keys_are_rejected(): void
    {
        $recorder = app(AnalyticsEventRecorder::class);

        foreach (['password', 'access_token', 'phone', 'national_id', 'session_id'] as $key) {
            try {
                $recorder->record('probe:'.$key, 'exam_started', null, [$key => 'anything']);
                $this->fail("کلید ممنوع «{$key}» باید رد شود.");
            } catch (ApiErrorException $error) {
                $this->assertSame('VALIDATION_FAILED', $error->errorCode);
                $this->assertSame(
                    ['properties' => ["FORBIDDEN_PROPERTY_KEY:{$key}"]],
                    $error->fields,
                );
            }
        }

        $this->assertSame(0, AnalyticsEvent::query()->count());
    }

    public function test_oversized_properties_are_rejected(): void
    {
        $recorder = app(AnalyticsEventRecorder::class);

        try {
            $recorder->record('probe:big', 'exam_started', null, [
                'blob' => str_repeat('x', (int) config('analytics.max_properties_bytes') + 100),
            ]);
            $this->fail('payload بزرگ‌تر از سقف باید رد شود.');
        } catch (ApiErrorException $error) {
            $this->assertSame(['properties' => ['PROPERTIES_TOO_LARGE']], $error->fields);
        }
    }

    // ── کش ──────────────────────────────────────────────────────────────

    public function test_the_cache_is_invalidated_by_real_domain_events(): void
    {
        $student = $this->signedInStudent(['phone' => '09124000010']);

        /* اولین خواندن ⇒ کش می‌شود (صفر). */
        $this->assertSame(0, $this->overview($student)['study']['study_seconds']);

        /* رویداد دامنه از مسیر واقعی ⇒ invalidate. */
        $this->recordStudySession($student, 900);

        $this->assertSame(900, $this->overview($student)['study']['study_seconds']);
    }

    public function test_the_cache_does_not_leak_between_users(): void
    {
        $first = $this->signedInStudent(['phone' => '09124000011']);
        $this->recordStudySession($first, 1200);

        $this->assertSame(1200, $this->overview($first)['study']['study_seconds']);

        $second = $this->signedInStudent(['phone' => '09124000012']);

        /* کاربر دوم نباید عدد کاربر اول را ببیند، حتی با کش فعال. */
        $this->assertSame(0, $this->overview($second)['study']['study_seconds']);

        /* و کش کاربر اول هم دست‌نخورده مانده. */
        $this->withAuthCookies($first['session']);
        $this->assertSame(1200, $this->overview($first)['study']['study_seconds']);
    }

    public function test_invalidating_one_user_does_not_touch_another(): void
    {
        $first = $this->signedInStudent(['phone' => '09124000013']);
        $this->recordStudySession($first, 600);
        $this->assertSame(600, $this->overview($first)['study']['study_seconds']);

        $second = $this->signedInStudent(['phone' => '09124000014']);
        $this->recordStudySession($second, 300);
        $this->assertSame(300, $this->overview($second)['study']['study_seconds']);

        /* باطل‌کردن کش کاربر اول نباید عدد کاربر دوم را عوض کند. */
        app(AnalyticsService::class)->invalidate($first['user']->getKey());

        $this->withAuthCookies($first['session']);
        $this->assertSame(600, $this->overview($first)['study']['study_seconds']);

        $this->withAuthCookies($second['session']);
        $this->assertSame(300, $this->overview($second)['study']['study_seconds']);
    }

    public function test_the_revision_counter_advances_on_invalidate(): void
    {
        $cache = app(AnalyticsCache::class);
        $userId = $this->signedInStudent(['phone' => '09124000015'])['user']->getKey();

        $prefix = (string) config('analytics.cache.prefix');
        $key = "{$prefix}:rev:{$userId}";

        $this->assertNull(Cache::get($key));

        $cache->invalidate($userId);
        $this->assertSame(1, (int) Cache::get($key));

        $cache->invalidate($userId);
        $this->assertSame(2, (int) Cache::get($key));
    }

    public function test_the_cache_can_be_disabled_by_configuration(): void
    {
        config(['analytics.cache.enabled' => false]);

        $student = $this->signedInStudent(['phone' => '09124000016']);

        $this->assertSame(0, $this->overview($student)['study']['study_seconds']);

        $this->recordStudySession($student, 450);

        /* بدون کش، هر خواندن تازه محاسبه می‌شود. */
        $this->assertSame(450, $this->overview($student)['study']['study_seconds']);
    }

    // ── کمکی ────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $student
     * @return array<string, mixed>
     */
    private function overview(array $student): array
    {
        $this->withAuthCookies($student['session']);

        return $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');
    }

    /** @param array<string, mixed> $student */
    private function recordStudySession(array $student, int $seconds): void
    {
        $this->withAuthCookies($student['session']);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => Carbon::now()->subSeconds($seconds)->toIso8601String(),
            'endedAt' => Carbon::now()->toIso8601String(),
            'source' => 'lesson',
        ], $student['csrf'])->assertStatus(201);
    }

    /** @param array<string, mixed> $student */
    private function answerQuestion(array $student, string $questionId, bool $correct): void
    {
        $this->withAuthCookies($student['session']);

        $question = Question::query()->findOrFail($questionId);
        $correctOptionId = (string) $question->key->correct_option_id;

        $option = $correct
            ? $correctOptionId
            : (string) $question->options->first(
                static fn ($candidate): bool => (string) $candidate->getKey() !== $correctOptionId,
            )->getKey();

        $this->postJsonWithOrigin('/api/v1/questions/'.$questionId.'/answers', [
            'selectedOptionId' => $option,
        ], $student['csrf'])->assertStatus(201);
    }

    /**
     * @param  array<string, mixed>  $student
     * @param  array{exam: Exam, questions: Collection<int, ExamQuestion>}  $built
     */
    private function sitExamAs(array $student, array $built, int $correctCount): void
    {
        $this->withAuthCookies($student['session']);

        $this->postJsonWithOrigin('/api/v1/exams/'.$built['exam']->getKey().'/registrations', [], $student['csrf'])
            ->assertStatus(201);

        $attemptId = $this->startAttempt($built['exam'], $student['csrf'])->assertStatus(201)->json('data.attempt.id');

        foreach ($built['questions'] as $index => $question) {
            $correct = $this->correctOptionIndex($question);
            $options = $question->render_snapshot['options'];
            $pick = $index < $correctCount ? $correct : ($correct + 1) % count($options);

            $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$attemptId.'/answers', [
                'questionId' => $question->getKey(),
                'selectedOptionId' => $this->optionIdAt($question, $pick),
                'revision' => 0,
            ], $student['csrf'])->assertOk();
        }

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$attemptId.'/finish', [], $student['csrf'])->assertOk();
    }
}
