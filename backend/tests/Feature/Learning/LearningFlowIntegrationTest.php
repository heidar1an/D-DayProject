<?php

namespace Tests\Feature\Learning;

use App\Models\HeartReward;
use App\Models\LearningProgress;
use App\Models\LessonPage;
use App\Models\Question;
use App\Models\QuestionAttempt;
use App\Models\StudySession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsQuestionBank;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * سناریوهای سرتاسری فاز ۵ + ۶.
 *
 * این‌ها تست واحد نیستند: هر سناریو مسیر واقعی کاربر را از ابتدا تا انتها
 * می‌رود و در پایان روی **دادهٔ ذخیره‌شده** تأیید می‌کند، نه فقط روی کد وضعیت.
 * اگر جایی بین لایه‌ها (Request → Service → Model → Resource) ناهم‌خوانی باشد،
 * اینجا دیده می‌شود.
 */
class LearningFlowIntegrationTest extends TestCase
{
    use BuildsQuestionBank, InteractsWithAdmin, RefreshDatabase;

    public function test_scenario_1_a_student_reads_a_lesson_and_records_progress(): void
    {
        $tree = $this->makeContentTree();
        $extra = LessonPage::factory()->published()->forLesson($tree['lesson'])->create();

        $session = $this->register();
        $this->withAuthCookies($session);

        // ۱. محتوای منتشرشده از مسیر عمومی قابل خواندن است.
        $this->getJson('/api/v1/subjects')->assertOk()->assertJsonPath('data.subjects.0.slug', $tree['subject']->slug);

        $courses = $this->getJson('/api/v1/courses')->assertOk()->json('data.courses');
        $this->assertContains($tree['course']->slug, array_column($courses, 'slug'));

        $this->getJson('/api/v1/courses/'.$tree['course']->slug)->assertOk();

        $this->getJson('/api/v1/lesson-pages/'.$tree['page']->getKey())
            ->assertOk()
            ->assertJsonPath('data.page.id', $tree['page']->getKey());

        // ۲. پیشرفت اول ذخیره می‌شود (شروع‌نشده → در جریان).
        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$tree['page']->getKey(), [
            'version' => 0,
            'lastPosition' => 40,
            'secondsSpent' => 90,
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_IN_PROGRESS);

        // ۳. نشست مطالعه ثبت می‌شود.
        $startedAt = now()->subMinutes(30);

        $this->postJsonWithOrigin('/api/v1/me/study-sessions', [
            'startedAt' => $startedAt->toIso8601String(),
            'endedAt' => $startedAt->copy()->addSeconds(1800)->toIso8601String(),
            'source' => StudySession::SOURCE_LESSON,
            'lessonPageId' => $tree['page']->getKey(),
        ], $this->csrfHeader($session))->assertStatus(201);

        // ۴. صفحه تمام می‌شود و صفحهٔ دوم شروع.
        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$tree['page']->getKey(), [
            'version' => 1,
            'lastPosition' => 999,
            'secondsSpent' => 120,
            'completed' => true,
        ], $this->csrfHeader($session))
            ->assertOk()
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_COMPLETED);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$extra->getKey(), [
            'version' => 0,
            'secondsSpent' => 30,
        ], $this->csrfHeader($session))->assertOk();

        // ۵. خلاصه از دادهٔ ذخیره‌شده مشتق می‌شود.
        $this->getJson('/api/v1/me/progress')
            ->assertOk()
            ->assertJsonPath('data.progress.totals.tracked_pages', 2)
            ->assertJsonPath('data.progress.totals.completed_pages', 1)
            ->assertJsonPath('data.progress.totals.seconds_spent', 240)
            ->assertJsonPath('data.progress.totals.study_sessions', 1)
            ->assertJsonPath('data.progress.totals.study_seconds', 1800)
            ->assertJsonPath('data.progress.courses.0.total_pages', 2)
            ->assertJsonPath('data.progress.courses.0.percent', 50);

        $this->assertSame(2, LearningProgress::query()->count());
        $this->assertSame(1, StudySession::query()->count());
    }

    public function test_scenario_2_a_student_practises_a_bank_session_and_gets_keys_only_after_answering(): void
    {
        $built = [];
        foreach (range(1, 3) as $ignored) {
            $built[] = $this->makeQuestion();
        }

        $session = $this->register();
        $this->withAuthCookies($session);

        // ۱. فهرست: بدون کلید.
        $list = $this->getJson('/api/v1/questions?perPage=10')->assertOk()->getContent();
        $this->assertStringNotContainsString('correct_option_id', $list);

        // ۲. سشن تمرین از سرور.
        $created = $this->postJsonWithOrigin('/api/v1/bank/sessions', [
            'filters' => ['difficulty' => 'medium'],
            'count' => 3,
            'mode' => 'practice',
        ], $this->csrfHeader($session))->assertStatus(201);

        $sessionId = $created->json('data.bank_session.session_id');
        $questions = $created->json('data.bank_session.questions');

        $this->assertCount(3, $questions);

        // ۳. هر سؤال پاسخ داده می‌شود؛ کلید فقط در همان پاسخ می‌آید.
        foreach ($questions as $index => $question) {
            $detail = $this->getJson('/api/v1/questions/'.$question['id'])->assertOk()->getContent();
            $this->assertStringNotContainsString('correct_option_id', $detail);

            $answer = $this->postJsonWithOrigin('/api/v1/questions/'.$question['id'].'/answers', [
                'selectedOptionId' => $question['options'][0]['id'],
                'attemptKey' => 'session-'.$index,
                'timeSpent' => 30,
            ], $this->csrfHeader($session))->assertStatus(201);

            $this->assertSame(
                $question['options'][0]['id'],
                $answer->json('data.attempt.selected_option_id'),
            );
            $this->assertNotNull($answer->json('data.attempt.reveal.correct_option_id'));
        }

        // ۴. همان مجموعه با همان ترتیب قابل خواندن است.
        $this->getJson('/api/v1/bank/sessions/'.$sessionId)
            ->assertOk()
            ->assertJsonCount(3, 'data.bank_session.questions');

        $this->assertSame(3, QuestionAttempt::query()->count());
        $this->assertSame(3, HeartReward::query()->count());
    }

    public function test_scenario_3_two_students_do_not_see_each_others_data(): void
    {
        $tree = $this->makeContentTree();
        $built = $this->makeQuestion();

        $alice = $this->register();
        $this->withAuthCookies($alice);

        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$tree['page']->getKey(), [
            'version' => 0,
            'completed' => true,
            'secondsSpent' => 300,
        ], $this->csrfHeader($alice))->assertOk();

        $this->postJsonWithOrigin('/api/v1/questions/'.$built['question']->getKey().'/answers', [
            'selectedOptionId' => $built['correct']->getKey(),
        ], $this->csrfHeader($alice))->assertStatus(201);

        $aliceSession = $this->postJsonWithOrigin('/api/v1/bank/sessions', ['count' => 1], $this->csrfHeader($alice))
            ->assertStatus(201)
            ->json('data.bank_session.session_id');

        $bob = $this->register(['phone' => '09120000009']);
        $this->withAuthCookies($bob);

        // باب همان صفحه را «شروع‌نشده» می‌بیند.
        $this->getJson('/api/v1/me/progress/pages/'.$tree['page']->getKey())
            ->assertOk()
            ->assertJsonPath('data.progress.status', LearningProgress::STATUS_NOT_STARTED)
            ->assertJsonPath('data.progress.seconds_spent', 0);

        $this->getJson('/api/v1/me/progress')
            ->assertOk()
            ->assertJsonPath('data.progress.totals.tracked_pages', 0);

        // سشن آلیس برای باب وجود ندارد.
        $this->getJson('/api/v1/bank/sessions/'.$aliceSession)->assertStatus(404);

        // و پاسخ‌های آلیس به باب نسبت داده نشده‌اند.
        $bobId = $this->getJson('/api/v1/me')->json('data.user.id');
        $this->assertSame(0, QuestionAttempt::query()->where('user_id', $bobId)->count());

        // باب می‌تواند مستقل پاسخ دهد و تلاش خودش ثبت می‌شود.
        $this->postJsonWithOrigin('/api/v1/questions/'.$built['question']->getKey().'/answers', [
            'selectedOptionId' => $built['options']->firstWhere('position', 2)->getKey(),
        ], $this->csrfHeader($bob))->assertStatus(201);

        $this->assertSame(2, QuestionAttempt::query()->count());
        $this->assertSame(1, QuestionAttempt::query()->where('user_id', $bobId)->count());
    }

    public function test_scenario_4_an_editor_publishes_a_question_that_students_can_then_answer(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $tree = $this->makeContentTree();

        $id = $this->postJsonWithOrigin('/api/v1/admin/questions', [
            'subject_id' => $tree['subject']->getKey(),
            'stem' => 'سؤال تازهٔ منتشرشده؟',
            'type' => 'single',
            'difficulty' => 'hard',
            'source' => 'official',
            'track' => 'medicine',
            'options' => [
                ['body' => 'الف'], ['body' => 'ب'], ['body' => 'ج'], ['body' => 'د'],
            ],
            'key' => ['correctPosition' => 4, 'explanation' => ['summary' => 'د درست است']],
        ], $this->adminCsrf())
            ->assertStatus(201)
            ->json('data.question.id');

        $this->postJsonWithOrigin('/api/v1/admin/questions/'.$id.'/publish', [], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.question.status', Question::STATUS_PUBLISHED);

        // دانشجو حالا آن را می‌بیند — ولی بدون کلید.
        $student = $this->register();
        $this->withAuthCookies($student);

        $visible = $this->getJson('/api/v1/questions?difficulty=hard')->assertOk();
        $this->assertSame($id, $visible->json('data.questions.0.id'));

        $detail = $this->getJson('/api/v1/questions/'.$id)->assertOk()->json('data.question');
        $this->assertSame(4, count($detail['options']));

        // پاسخ درست از گزینهٔ چهارم.
        $answer = $this->postJsonWithOrigin('/api/v1/questions/'.$id.'/answers', [
            'selectedOptionId' => $detail['options'][3]['id'],
        ], $this->csrfHeader($student))
            ->assertStatus(201)
            ->assertJsonPath('data.attempt.is_correct', true)
            ->assertJsonPath('data.attempt.question_version', 1)
            ->assertJsonPath('data.attempt.reveal.explanation.summary', 'د درست است');

        $attempt = QuestionAttempt::query()->firstOrFail();

        $this->assertSame($id, $attempt->question_id);
        $this->assertSame(1, (int) $attempt->question_version);
        $this->assertSame($answer->json('data.attempt.attempt_id'), $attempt->getKey());
    }

    public function test_scenario_5_network_retries_never_double_write(): void
    {
        $tree = $this->makeContentTree();
        $built = $this->makeQuestion();

        $session = $this->register();
        $this->withAuthCookies($session);

        $headers = $this->csrfHeader($session);

        // ۱. retry ذخیرهٔ پیشرفت.
        $progressHeaders = [...$headers, 'Idempotency-Key' => 'flow-progress-1'];
        $payload = ['version' => 0, 'secondsSpent' => 60, 'lastPosition' => 5];

        for ($i = 0; $i < 3; $i++) {
            $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$tree['page']->getKey(), $payload, $progressHeaders)
                ->assertOk();
        }

        $this->assertSame(1, LearningProgress::query()->count());
        $this->assertSame(60, LearningProgress::query()->firstOrFail()->seconds_spent);

        // ۲. retry نشست مطالعه.
        $startedAt = now()->subMinutes(20);
        $sessionPayload = [
            'startedAt' => $startedAt->toIso8601String(),
            'endedAt' => $startedAt->copy()->addSeconds(600)->toIso8601String(),
            'source' => StudySession::SOURCE_POMODORO,
        ];

        $sessionHeaders = [...$headers, 'Idempotency-Key' => 'flow-session-1'];

        for ($i = 0; $i < 2; $i++) {
            $this->postJsonWithOrigin('/api/v1/me/study-sessions', $sessionPayload, $sessionHeaders)
                ->assertStatus(201);
        }

        $this->assertSame(1, StudySession::query()->count());

        // ۳. retry پاسخ سؤال.
        $answerPayload = [
            'selectedOptionId' => $built['correct']->getKey(),
            'attemptKey' => 'flow-answer-1',
        ];

        for ($i = 0; $i < 3; $i++) {
            $this->postJsonWithOrigin('/api/v1/questions/'.$built['question']->getKey().'/answers', $answerPayload, $headers)
                ->assertStatus(201);
        }

        $this->assertSame(1, QuestionAttempt::query()->count());
        $this->assertSame(1, HeartReward::query()->count());
    }

    public function test_scenario_6_no_student_endpoint_leaks_internal_state_or_confirms_a_draft(): void
    {
        $draft = $this->makeQuestion([], 1, 4, false);
        $published = $this->makeQuestion();

        $session = $this->register();
        $this->withAuthCookies($session);

        // ۱. پیش‌نویس در هیچ مسیری تأیید نمی‌شود.
        $this->getJson('/api/v1/questions/'.$draft['question']->getKey())->assertStatus(404);
        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$draft['question']->getKey().'/answers',
            ['selectedOptionId' => $draft['correct']->getKey()],
            $this->csrfHeader($session),
        )->assertStatus(404);

        // ۲. شمارش کل: هیچ راهی برای گرفتن «همهٔ سؤال‌ها» با پارامتر ناشناخته نیست.
        $this->getJson('/api/v1/questions?status=draft')->assertStatus(400);

        // ۳. هیچ پاسخ دانشجویی حاوی کلید یا شناسهٔ مالک یا متادیتای داخلی نیست.
        $contents = [
            $this->getJson('/api/v1/questions')->assertOk()->getContent(),
            $this->getJson('/api/v1/questions/'.$published['question']->getKey())->assertOk()->getContent(),
            $this->postJsonWithOrigin(
                '/api/v1/questions/'.$published['question']->getKey().'/answers',
                ['selectedOptionId' => $published['correct']->getKey()],
                $this->csrfHeader($session),
            )->assertStatus(201)->getContent(),
            $this->getJson('/api/v1/me/progress')->assertOk()->getContent(),
        ];

        $forbidden = ['password_hash', 'user_id', 'guest_id', 'author_admin_id', 'legacy_id'];

        foreach ($contents as $index => $content) {
            foreach ($forbidden as $needle) {
                $this->assertStringNotContainsString($needle, $content, "leak '{$needle}' in payload #{$index}");
            }
        }

        // استثنا: کلید پاسخ **بعد از** پاسخ مجاز است — همان یک مورد.
        $this->assertStringContainsString('correct_option_id', $contents[2]);
    }
}
