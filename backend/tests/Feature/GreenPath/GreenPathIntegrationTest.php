<?php

namespace Tests\Feature\GreenPath;

use App\Models\GreenPath;
use App\Models\GreenPathStep;
use App\Models\LessonPage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۱۳ — Integration: مسیر سبز فقط **مصرف‌کنندهٔ** پیشرفت واقعی است.
 *
 *   Progress/Exam واقعی → Event → GreenPathService → قدم completed
 * و هیچ مسیر معکوسی وجود ندارد. همچنین Rebuild تنبل نسخه‌دار است.
 */
class GreenPathIntegrationTest extends TestCase
{
    use BuildsExams, BuildsQuestionBank, RefreshDatabase;

    public function test_completing_all_lesson_pages_completes_the_lesson_step(): void
    {
        $page1 = $this->makePublishedPage();
        $page2 = LessonPage::factory()->published()->create(['lesson_id' => $page1->lesson_id]);

        $student = $this->signedInStudent();
        $this->getJson('/api/v1/me/green-path/roadmap')->assertOk();

        $step = GreenPathStep::query()->sole();
        $this->assertSame(GreenPathStep::KIND_LESSON, $step->kind);
        $this->assertNotSame(GreenPathStep::STATUS_COMPLETED, $step->status);

        /* صفحهٔ اول کامل می‌شود؛ درس هنوز کامل نیست ⇒ قدم هم نه. */
        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page1->getKey(), [
            'version' => 0,
            'completed' => true,
        ], $student['csrf'])->assertOk();

        $this->assertNotSame(GreenPathStep::STATUS_COMPLETED, $step->refresh()->status);

        /* صفحهٔ دوم ⇒ درس واقعاً کامل ⇒ قدم توسط موتور بسته می‌شود. */
        $this->putJsonWithOrigin('/api/v1/me/progress/pages/'.$page2->getKey(), [
            'version' => 0,
            'completed' => true,
        ], $student['csrf'])->assertOk();

        $step->refresh();
        $this->assertSame(GreenPathStep::STATUS_COMPLETED, $step->status);
        $this->assertNotNull($step->completed_at);

        /* هیچ completion جعلی به Progress تزریق نشده: پیشرفت فقط از مسیر خودش. */
        $this->getJson('/api/v1/me/green-path/roadmap')
            ->assertOk()
            ->assertJsonPath('data.progress.completed_steps', 1)
            ->assertJsonPath('data.progress.percent', 100);
    }

    public function test_finishing_a_real_exam_completes_the_exam_step(): void
    {
        /* آزمون زمان‌بندی‌شدهٔ واقعی (پنجرهٔ برگزاری باز) — opens_at دارد. */
        ['exam' => $exam] = $this->makeExam();

        $student = $this->signedInStudent();
        $this->getJson('/api/v1/me/green-path/roadmap')->assertOk();

        $examStep = GreenPathStep::query()->where('kind', GreenPathStep::KIND_EXAM)->sole();
        $this->assertNotSame(GreenPathStep::STATUS_COMPLETED, $examStep->status);

        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $student['csrf'])
            ->assertStatus(201);

        $attemptId = $this->startAttempt($exam, $student['csrf'])->assertStatus(201)->json('data.attempt.id');

        $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$attemptId.'/finish', [], $student['csrf'])
            ->assertOk();

        $examStep->refresh();
        $this->assertSame(GreenPathStep::STATUS_COMPLETED, $examStep->status);
        $this->assertNotNull($examStep->completed_at);
    }

    public function test_new_published_content_triggers_a_versioned_lazy_rebuild(): void
    {
        $this->makePublishedPage();
        $student = $this->signedInStudent();
        $this->getJson('/api/v1/me/green-path/roadmap')->assertOk();

        $path = GreenPath::query()->sole();
        $this->assertSame(1, (int) $path->plan_version);
        $this->assertSame(1, $path->steps()->count());

        /* محتوای تازه منتشر می‌شود ⇒ خواندن بعدی rebuild نسخهٔ ۲ می‌دهد. */
        LessonPage::factory()->published()->create();

        $response = $this->getJson('/api/v1/me/green-path/roadmap')
            ->assertOk()
            ->assertJsonPath('data.path.plan_version', 2)
            ->assertJsonPath('data.progress.total_steps', 2);

        $this->assertSame(2, GreenPath::query()->count());
        $this->assertSame(
            1,
            GreenPath::query()->where('status', GreenPath::STATUS_ACTIVE)->count(),
            'فقط یک مسیر فعال per-user',
        );
        $this->assertSame(
            1,
            GreenPath::query()->where('status', GreenPath::STATUS_ARCHIVED)->count(),
            'مسیر قبلی حذف نمی‌شود — archived می‌ماند',
        );
    }
}
