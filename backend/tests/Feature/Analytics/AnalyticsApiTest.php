<?php

namespace Tests\Feature\Analytics;

use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\Question;
use App\Models\QuestionTopic;
use App\Models\Subject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * API تحلیل کاربر — فاز ۸.
 *
 * تمرکز تست‌ها روی چهار چیزی است که واقعاً می‌توانند خراب شوند:
 *   ۱. **منبع هر عدد** — اگر روزی کسی `exam_answers` را به مخرج دقت تمرین اضافه
 *      کند، یا `study_seconds` و `reading_seconds` را جمع کند، اینجا سرخ می‌شود؛
 *   ۲. **انتشارنشده‌ها** — هیچ عددی از نتیجهٔ منتشرنشده نباید در تجمیع بیاید؛
 *   ۳. **مالکیت** — تحلیل فقط از سشن؛ هیچ `userId` ای از بیرون اثر ندارد؛
 *   ۴. **صفر بودن** — کاربر بی‌داده باید صفر ببیند، نه خطا.
 *
 * کش در این فایل **خاموش** است تا هر عدد دقیقاً همان لحظه محاسبه شود.
 * رفتار کش در `AnalyticsCacheTest` جداگانه تست می‌شود.
 */
class AnalyticsApiTest extends TestCase
{
    use BuildsExams, BuildsQuestionBank, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['analytics.cache.enabled' => false]);
    }

    // ── دسترسی ──────────────────────────────────────────────────────────

    public function test_every_analytics_route_requires_a_session(): void
    {
        foreach (['overview', 'topics', 'exams', 'progress'] as $section) {
            $this->getJson('/api/v1/me/analytics/'.$section)
                ->assertStatus(401)
                ->assertJsonPath('error.code', 'UNAUTHENTICATED');
        }
    }

    public function test_a_user_with_no_data_sees_zeros_not_an_error(): void
    {
        $this->signedInStudent(['phone' => '09123000001']);

        $overview = $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');

        $this->assertSame(0, $overview['study']['study_seconds']);
        $this->assertSame(0, $overview['study']['reading_seconds']);
        $this->assertSame(0, $overview['learning']['completed_pages']);
        $this->assertSame(0, $overview['questions']['answered']);
        $this->assertSame(0.0, (float) $overview['questions']['accuracy']);
        $this->assertSame(0, $overview['exams']['attempts']);
        $this->assertSame([], $overview['recent_activity']);

        $this->assertSame([], $this->getJson('/api/v1/me/analytics/topics')->assertOk()->json('data.analytics.topics'));
        $this->assertSame([], $this->getJson('/api/v1/me/analytics/exams')->assertOk()->json('data.analytics.recent'));
        $this->assertSame([], $this->getJson('/api/v1/me/analytics/progress')->assertOk()->json('data.analytics.courses'));
    }

    public function test_an_unknown_query_parameter_is_rejected(): void
    {
        $this->signedInStudent(['phone' => '09123000002']);

        $this->getJson('/api/v1/me/analytics/overview?userId=someone-else')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER')
            ->assertJsonPath('error.fields.query.0', 'userId');
    }

    public function test_an_invalid_timezone_is_rejected(): void
    {
        $this->signedInStudent(['phone' => '09123000003']);

        $this->getJson('/api/v1/me/analytics/progress?tz=Mars/Olympus')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonPath('error.fields.tz.0', 'The selected tz is invalid.');
    }

    // ── نمای کلی ────────────────────────────────────────────────────────

    public function test_overview_reports_each_metric_from_its_own_source(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000010']);
        $tree = $this->makeContentTree();

        $this->completePage($student, $tree['page']->getKey(), 120);
        $this->recordStudySession($student, 1500);
        $this->answerQuestion($student, $this->makeQuestion()['question']->getKey(), true);

        $built = $this->makeExam([], 2);
        $this->sitExamAs($student, $built, 2);

        $overview = $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');

        /* مطالعه — دو سنجهٔ مستقل، هرگز جمع‌شده */
        $this->assertSame(1500, $overview['study']['study_seconds']);
        $this->assertSame(120, $overview['study']['reading_seconds']);
        $this->assertSame(1, $overview['study']['study_sessions']);
        $this->assertSame(1, $overview['study']['tracked_pages']);

        $this->assertNotSame(
            $overview['study']['study_seconds'],
            $overview['study']['reading_seconds'],
            'دو سنجهٔ مطالعه نباید در یک عدد جمع شوند.',
        );

        /* یادگیری */
        $this->assertSame(1, $overview['learning']['completed_pages']);
        $this->assertSame(1, $overview['learning']['completed_lessons']);

        /* تمرین مستقل — فقط از question_attempts */
        $this->assertSame(1, $overview['questions']['answered']);
        $this->assertSame(1, $overview['questions']['correct']);
        $this->assertSame(0, $overview['questions']['wrong']);
        $this->assertSame(100.0, (float) $overview['questions']['accuracy']);

        /* آزمون — فقط از exam_results منتشرشده */
        $this->assertSame(1, $overview['exams']['attempts']);
        $this->assertSame(1, $overview['exams']['graded']);
        $this->assertSame(100.0, (float) $overview['exams']['average_score']);
        $this->assertSame(100.0, (float) $overview['exams']['highest_score']);

        /* رویدادها ثبت شده‌اند (ExamStarted/Finished + QuestionAnswered + StudySession) */
        $this->assertNotEmpty($overview['recent_activity']);
    }

    public function test_overview_never_counts_exam_answers_as_practice_accuracy(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000011']);

        /* یک پاسخ تمرینی غلط */
        $this->answerQuestion($student, $this->makeQuestion()['question']->getKey(), false);

        /* و یک آزمون با دو پاسخ درست */
        $built = $this->makeExam([], 2);
        $this->sitExamAs($student, $built, 2);

        $overview = $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');

        /* دقت تمرین فقط از همان یک پاسخ غلط است — نه ۳ پاسخ. */
        $this->assertSame(1, $overview['questions']['answered']);
        $this->assertSame(0, $overview['questions']['correct']);
        $this->assertSame(0.0, (float) $overview['questions']['accuracy']);

        /* و دقت آزمون جدا: ۲ درست از ۲ */
        $this->assertSame(1, $overview['exams']['graded']);
        $this->assertSame(100.0, (float) $overview['exams']['average_score']);
    }

    public function test_an_unreleased_exam_result_never_enters_the_aggregate(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000012']);

        $built = $this->makeExam(['result_release_at' => Carbon::now()->addHour()], 2);
        $this->sitExamAs($student, $built, 2);

        $before = $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');

        /* Attempt نهایی شده، ولی هیچ عدد نمره‌ای افشا نمی‌شود. */
        $this->assertSame(1, $before['exams']['attempts']);
        $this->assertSame(0, $before['exams']['graded']);
        $this->assertSame(0.0, (float) $before['exams']['average_score']);
        $this->assertSame(0.0, (float) $before['exams']['highest_score']);

        $this->release($built['exam']);

        $after = $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');

        $this->assertSame(1, $after['exams']['graded']);
        $this->assertSame(100.0, (float) $after['exams']['highest_score']);
    }

    // ── عملکرد آزمون ────────────────────────────────────────────────────

    public function test_exam_analytics_excludes_unreleased_results_and_uses_exam_denominators(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000013']);

        /* آزمون منتشرشده: ۲ درست از ۲ */
        $released = $this->makeExam([], 2);
        $this->sitExamAs($student, $released, 2);

        /* آزمون منتشرنشده: ۰ درست از ۲ — نباید هیچ عددی به تحلیل اضافه کند */
        $pending = $this->makeExam(['result_release_at' => Carbon::now()->addDay()], 2);
        $this->sitExamAs($student, $pending, 0);

        $analytics = $this->getJson('/api/v1/me/analytics/exams')->assertOk()->json('data.analytics');

        $this->assertSame(2, $analytics['totals']['attempts'], 'هر دو Attempt نهایی شده‌اند.');
        $this->assertSame(1, $analytics['totals']['graded'], 'فقط نتیجهٔ منتشرشده تجمیع می‌شود.');
        $this->assertSame(100.0, (float) $analytics['totals']['highest_score']);
        $this->assertSame(100.0, (float) $analytics['totals']['accuracy']);

        $this->assertCount(1, $analytics['recent']);
        $this->assertSame($released['exam']->getKey(), $analytics['recent'][0]['exam_id']);

        $this->release($pending['exam']);

        $after = $this->getJson('/api/v1/me/analytics/exams')->assertOk()->json('data.analytics');

        $this->assertSame(2, $after['totals']['graded']);
        $this->assertSame(50.0, (float) $after['totals']['average_score']);
        $this->assertCount(2, $after['recent']);
    }

    public function test_exam_subject_performance_comes_from_the_stored_breakdown(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000014']);

        $built = $this->makeExam([], 2);
        $this->sitExamAs($student, $built, 1);

        $analytics = $this->getJson('/api/v1/me/analytics/exams')->assertOk()->json('data.analytics');

        $this->assertNotEmpty($analytics['subjects']);

        $totals = array_sum(array_column($analytics['subjects'], 'total'));

        $this->assertSame(2, $totals, 'جمع total در breakdown باید تعداد سؤال‌های آزمون باشد.');
        $this->assertSame(50.0, (float) $analytics['subjects'][0]['accuracy']);
    }

    // ── عملکرد موضوعی ───────────────────────────────────────────────────

    public function test_topic_analytics_groups_real_practice_attempts(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000015']);

        $subject = Subject::factory()->published()->create();
        $topic = QuestionTopic::factory()->create([
            'subject_id' => $subject->getKey(),
            'slug' => 'cardio',
            'title' => 'قلب',
        ]);

        $first = $this->makeQuestion(['subject_id' => $subject->getKey(), 'topic_id' => $topic->getKey()])['question'];
        $second = $this->makeQuestion(['subject_id' => $subject->getKey(), 'topic_id' => $topic->getKey()])['question'];

        $this->answerQuestion($student, $first->getKey(), true);
        $this->answerQuestion($student, $second->getKey(), false);

        $analytics = $this->getJson('/api/v1/me/analytics/topics')->assertOk()->json('data.analytics');

        $this->assertCount(1, $analytics['topics']);

        $row = $analytics['topics'][0];

        $this->assertSame('cardio', $row['topic_slug']);
        $this->assertSame('قلب', $row['topic_title']);
        $this->assertSame(2, $row['attempts']);
        $this->assertSame(1, $row['correct']);
        $this->assertSame(1, $row['wrong']);
        $this->assertSame(50.0, (float) $row['accuracy']);

        $this->assertSame(1, $analytics['totals']['topics']);
        $this->assertSame(2, $analytics['totals']['attempts']);
        $this->assertSame(50.0, (float) $analytics['totals']['accuracy']);
    }

    public function test_topic_analytics_ignores_exam_answers(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000016']);

        /* فقط یک آزمون، بدون هیچ تمرین مستقل */
        $built = $this->makeExam([], 2);
        $this->sitExamAs($student, $built, 2);

        $analytics = $this->getJson('/api/v1/me/analytics/topics')->assertOk()->json('data.analytics');

        $this->assertSame([], $analytics['topics'], 'پاسخ‌های آزمون نباید در عملکرد موضوعی تمرین بیایند.');
        $this->assertSame(0, $analytics['totals']['attempts']);
    }

    // ── پیشرفت و روند ───────────────────────────────────────────────────

    public function test_progress_analytics_computes_course_percent_from_visible_pages(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000017']);
        $tree = $this->makeContentTree();

        $this->completePage($student, $tree['page']->getKey(), 60);

        $analytics = $this->getJson('/api/v1/me/analytics/progress')->assertOk()->json('data.analytics');

        $this->assertCount(1, $analytics['courses']);

        $course = $analytics['courses'][0];

        $this->assertSame($tree['course']->getKey(), $course['course_id']);
        $this->assertSame(1, $course['completed_pages']);
        $this->assertSame(1, $course['total_pages']);
        $this->assertSame(100, $course['percent']);
        $this->assertSame(60, $course['seconds_spent']);

        $this->assertSame(1, $analytics['totals']['completed_pages']);
        $this->assertSame(1, $analytics['totals']['completed_lessons']);
        $this->assertSame(60, $analytics['totals']['reading_seconds']);
    }

    public function test_progress_trend_buckets_study_time_and_completions(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000018']);
        $tree = $this->makeContentTree();

        $this->completePage($student, $tree['page']->getKey(), 30);
        $this->recordStudySession($student, 900);

        $response = $this->getJson('/api/v1/me/analytics/progress?bucket=daily')->assertOk();

        $this->assertSame('daily', $response->json('data.meta.bucket'));

        $trend = $response->json('data.analytics.trend');

        $this->assertNotEmpty($trend);
        $this->assertSame(900, array_sum(array_column($trend, 'study_seconds')));
        $this->assertSame(1, array_sum(array_column($trend, 'completed_pages')));

        /* دانه‌بندی ماهانه هم باید همان مجموع را بدهد. */
        $monthly = $this->getJson('/api/v1/me/analytics/progress?bucket=monthly')->assertOk()->json('data.analytics.trend');

        $this->assertSame(900, array_sum(array_column($monthly, 'study_seconds')));
    }

    public function test_the_timezone_shifts_the_bucket_boundary(): void
    {
        $student = $this->signedInStudent(['phone' => '09123000019']);

        /* یک نشست مطالعه در همین لحظه */
        $this->recordStudySession($student, 600);

        $utc = $this->getJson('/api/v1/me/analytics/progress?bucket=daily&tz=UTC')->assertOk();
        $tehran = $this->getJson('/api/v1/me/analytics/progress?bucket=daily&tz=Asia/Tehran')->assertOk();

        $this->assertSame('UTC', $utc->json('data.meta.timezone'));
        $this->assertSame('Asia/Tehran', $tehran->json('data.meta.timezone'));

        /* مجموع مستقل از timezone است؛ فقط کلید سطل می‌تواند جابه‌جا شود. */
        $this->assertSame(600, array_sum(array_column($utc->json('data.analytics.trend'), 'study_seconds')));
        $this->assertSame(600, array_sum(array_column($tehran->json('data.analytics.trend'), 'study_seconds')));
    }

    // ── مالکیت ──────────────────────────────────────────────────────────

    public function test_analytics_are_isolated_per_user(): void
    {
        $first = $this->signedInStudent(['phone' => '09123000020']);

        $built = $this->makeExam([], 2);
        $this->sitExamAs($first, $built, 2);
        $this->answerQuestion($first, $this->makeQuestion()['question']->getKey(), true);
        $this->recordStudySession($first, 1200);

        /* کاربر دوم با سشن تازه */
        $this->signedInStudent(['phone' => '09123000021']);

        $second = $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');

        $this->assertSame(0, $second['study']['study_seconds']);
        $this->assertSame(0, $second['questions']['answered']);
        $this->assertSame(0, $second['exams']['graded']);
        $this->assertSame([], $second['recent_activity']);

        /* و صاحب داده همان اعداد را می‌بیند. */
        $this->withAuthCookies($first['session']);

        $mine = $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');

        $this->assertSame(1200, $mine['study']['study_seconds']);
        $this->assertSame(1, $mine['questions']['answered']);
        $this->assertSame(1, $mine['exams']['graded']);
    }

    public function test_a_user_id_from_outside_the_session_is_ignored(): void
    {
        $first = $this->signedInStudent(['phone' => '09123000022']);
        $this->recordStudySession($first, 900);

        $this->signedInStudent(['phone' => '09123000023']);

        /* پارامتر `userId` در query پذیرفته نمی‌شود ⇒ ۴۰۰، نه دادهٔ کاربر دیگر. */
        $this->getJson('/api/v1/me/analytics/overview?userId='.$first['user']->getKey())
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');

        /* و خواندن عادی فقط دادهٔ خودِ صاحب سشن را می‌دهد. */
        $mine = $this->getJson('/api/v1/me/analytics/overview')->assertOk()->json('data.analytics');

        $this->assertSame(0, $mine['study']['study_seconds']);
        $this->assertSame(0, $mine['questions']['answered']);
    }

    // ── کمکی ────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $student */
    private function completePage(array $student, string $pageId, int $seconds): void
    {
        $this->withAuthCookies($student['session']);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$pageId, [
            'version' => 0,
            'completed' => true,
            'secondsSpent' => $seconds,
        ], $student['csrf'])->assertOk();
    }

    /** @param array<string, mixed> $student */
    private function recordStudySession(array $student, int $seconds): void
    {
        $this->withAuthCookies($student['session']);

        $startedAt = Carbon::now()->subSeconds($seconds);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => $startedAt->toIso8601String(),
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
     * نشستن یک آزمون **با هویت موجود** — بدون تغییر سشن کلاینت.
     *
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

    /** انتشار نتیجهٔ یک آزمون — بدون رویداد دامنه (فقط تغییر ستون). */
    private function release(Exam $exam): void
    {
        Exam::query()->whereKey($exam->getKey())->update(['result_release_at' => Carbon::now()->subMinute()]);
    }
}
