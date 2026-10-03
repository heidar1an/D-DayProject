<?php

namespace Tests\Feature\QuestionBank;

use App\Models\Permission;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsQuestionBank;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * فاز ۶ — CRUD سؤال در پنل.
 *
 * سه محور تست:
 *   ۱. **مرز هویت:** سشن دانشجو هرگز از مسیر پنل عبور نمی‌کند.
 *   ۲. **مجوز واقعی:** `testbank.*` از RBAC فاز ۳، نه کلید اختراعی.
 *   ۳. **یکپارچگی:** نسخه‌بندی، عدم تغییر درس، و «حذف فیزیکی وجود ندارد».
 */
class AdminQuestionCrudTest extends TestCase
{
    use BuildsQuestionBank, InteractsWithAdmin, RefreshDatabase;

    /** @return array<string, mixed> */
    private function createPayload(string $subjectId, array $overrides = []): array
    {
        return array_merge([
            'subject_id' => $subjectId,
            'stem' => 'کدام گزینه صحیح است؟',
            'type' => 'single',
            'difficulty' => 'medium',
            'source' => 'tapesh',
            'track' => 'medicine',
            'options' => [
                ['label' => '1', 'body' => 'گزینهٔ الف'],
                ['label' => '2', 'body' => 'گزینهٔ ب'],
                ['label' => '3', 'body' => 'گزینهٔ ج'],
            ],
            'key' => ['correctPosition' => 2, 'explanation' => ['summary' => 'چون ب درست است']],
        ], $overrides);
    }

    public function test_a_guest_cannot_reach_the_admin_routes(): void
    {
        $this->getJson('/api/v1/admin/questions')->assertStatus(401);
    }

    public function test_a_student_session_cannot_reach_the_admin_routes(): void
    {
        $session = $this->register();
        $this->withAuthCookies($session);

        $this->getJson('/api/v1/admin/questions')->assertStatus(401);
        $this->getJson('/api/v1/admin/auth/me')->assertStatus(401);
    }

    public function test_an_admin_without_any_role_is_forbidden_by_default(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeRolelessAdmin());

        $this->getJson('/api/v1/admin/questions')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_an_admin_without_the_create_permission_cannot_create(): void
    {
        $this->seedRbac();

        $role = Role::query()->create([
            'key' => 'viewer-only',
            'name' => 'فقط‌خوان',
            'is_system' => false,
        ]);

        $role->permissions()->attach(
            Permission::query()->where('key', 'testbank.read')->value('id'),
        );

        $this->actingAsAdmin($this->makeAdmin('viewer-only'));

        $tree = $this->makeContentTree();

        $this->getJson('/api/v1/admin/questions')->assertOk();

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions',
            $this->createPayload($tree['subject']->getKey()),
            $this->adminCsrf(),
        )->assertStatus(403);

        $this->assertSame(0, Question::query()->count());
    }

    public function test_an_editor_can_create_a_draft_question_with_its_key(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $tree = $this->makeContentTree();

        $response = $this->postJsonWithOrigin(
            '/api/v1/admin/questions',
            $this->createPayload($tree['subject']->getKey(), [
                'chapter_id' => $tree['chapter']->getKey(),
                'lesson_id' => $tree['lesson']->getKey(),
            ]),
            $this->adminCsrf(),
        );

        $response->assertStatus(201)
            ->assertJsonPath('data.question.status', Question::STATUS_DRAFT)
            ->assertJsonPath('data.question.version', 1)
            ->assertJsonPath('data.question.key.key_version', 1)
            ->assertJsonPath('data.question.key.explanation.summary', 'چون ب درست است')
            ->assertJsonCount(3, 'data.question.options');

        $question = Question::query()->firstOrFail();

        $this->assertNotNull($question->author_admin_id);
        $this->assertSame(
            $question->options()->where('position', 2)->value('id'),
            $question->key->correct_option_id,
        );
    }

    public function test_client_supplied_status_version_and_author_are_ignored(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $tree = $this->makeContentTree();

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions',
            $this->createPayload($tree['subject']->getKey(), [
                'status' => Question::STATUS_PUBLISHED,
                'version' => 99,
                'published_at' => now()->toIso8601String(),
                'author_admin_id' => Str::uuid(),
                'legacy_id' => 'tb-hack-01',
            ]),
            $this->adminCsrf(),
        )
            ->assertStatus(201)
            ->assertJsonPath('data.question.status', Question::STATUS_DRAFT)
            ->assertJsonPath('data.question.version', 1);

        $question = Question::query()->firstOrFail();

        $this->assertNull($question->published_at);
        $this->assertNull($question->legacy_id);
    }

    public function test_a_draft_question_is_invisible_to_students_until_published(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $tree = $this->makeContentTree();

        $id = $this->postJsonWithOrigin(
            '/api/v1/admin/questions',
            $this->createPayload($tree['subject']->getKey()),
            $this->adminCsrf(),
        )->assertStatus(201)->json('data.question.id');

        $this->getJson('/api/v1/questions')->assertOk()->assertJsonCount(0, 'data.questions');

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions/'.$id.'/publish',
            [],
            $this->adminCsrf(),
        )
            ->assertOk()
            ->assertJsonPath('data.question.status', Question::STATUS_PUBLISHED);

        $this->getJson('/api/v1/questions')->assertOk()->assertJsonCount(1, 'data.questions');
    }

    public function test_a_question_without_a_key_cannot_be_published(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $tree = $this->makeContentTree();

        $question = Question::factory()->create(['subject_id' => $tree['subject']->getKey()]);

        foreach ([1, 2] as $position) {
            QuestionOption::factory()->create([
                'question_id' => $question->getKey(),
                'position' => $position,
                'body' => 'گزینه '.$position,
            ]);
        }

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions/'.$question->getKey().'/publish',
            [],
            $this->adminCsrf(),
        )
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'QUESTION_NOT_PUBLISHABLE');
    }

    public function test_a_key_pointing_outside_the_question_blocks_publication(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $built = $this->makeQuestion([], 1, 4, false);

        // کلید به گزینهٔ سؤال دیگری اشاره می‌کند — یکپارچگی محتوا شکسته است.
        $built['question']->key->forceFill([
            'correct_option_id' => $this->foreignOptionId(),
        ])->save();

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions/'.$built['question']->getKey().'/publish',
            [],
            $this->adminCsrf(),
        )
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'QUESTION_NOT_PUBLISHABLE');
    }

    public function test_updating_content_bumps_the_question_version(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $built = $this->makeQuestion([], 1, 4, false);

        $this->patchJsonWithOrigin(
            '/api/v1/admin/questions/'.$built['question']->getKey(),
            ['version' => 1, 'stem' => 'متن ویرایش‌شده؟'],
            $this->adminCsrf(),
        )
            ->assertOk()
            ->assertJsonPath('data.question.version', 2)
            ->assertJsonPath('data.question.stem', 'متن ویرایش‌شده؟');
    }

    public function test_changing_the_correct_position_bumps_the_key_version(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $built = $this->makeQuestion([], 1, 4, false);

        $this->patchJsonWithOrigin(
            '/api/v1/admin/questions/'.$built['question']->getKey(),
            ['version' => 1, 'key' => ['correctPosition' => 3]],
            $this->adminCsrf(),
        )
            ->assertOk()
            ->assertJsonPath('data.question.key.key_version', 2);

        $this->assertSame(
            $built['question']->options()->where('position', 3)->value('id'),
            $built['question']->refresh()->key->correct_option_id,
        );
    }

    public function test_a_stale_version_on_update_is_409(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $built = $this->makeQuestion([], 1, 4, false);

        $this->patchJsonWithOrigin(
            '/api/v1/admin/questions/'.$built['question']->getKey(),
            ['version' => 1, 'stem' => 'اول'],
            $this->adminCsrf(),
        )->assertOk();

        $this->patchJsonWithOrigin(
            '/api/v1/admin/questions/'.$built['question']->getKey(),
            ['version' => 1, 'stem' => 'دوم'],
            $this->adminCsrf(),
        )
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'VERSION_CONFLICT');

        $this->assertSame('اول', $built['question']->refresh()->stem);
    }

    public function test_changing_the_subject_is_rejected_without_writing_anything(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $built = $this->makeQuestion([], 1, 4, false);
        $other = $this->makeContentTree();

        $this->patchJsonWithOrigin(
            '/api/v1/admin/questions/'.$built['question']->getKey(),
            [
                'version' => 1,
                'subject_id' => $other['subject']->getKey(),
                'stem' => 'نباید ذخیره شود',
            ],
            $this->adminCsrf(),
        )
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'SUBJECT_IMMUTABLE');

        $question = $built['question']->refresh();

        // نه محتوا عوض شده، نه نسخه بالا رفته — ۴۰۹ یعنی «هیچ اتفاقی نیفتاد».
        $this->assertSame($built['question']->stem, $question->stem);
        $this->assertSame(1, (int) $question->version);
    }

    public function test_archiving_hides_the_question_and_freezes_edits(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $built = $this->makeQuestion();

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions/'.$built['question']->getKey().'/archive',
            [],
            $this->adminCsrf(),
        )
            ->assertOk()
            ->assertJsonPath('data.question.status', Question::STATUS_ARCHIVED);

        $this->getJson('/api/v1/questions')->assertOk()->assertJsonCount(0, 'data.questions');

        $this->patchJsonWithOrigin(
            '/api/v1/admin/questions/'.$built['question']->getKey(),
            ['version' => 1, 'stem' => 'ویرایش پس از آرشیو'],
            $this->adminCsrf(),
        )
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'QUESTION_ARCHIVED');
    }

    public function test_there_is_no_physical_delete_route(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('super-admin'));

        $built = $this->makeQuestion();

        $this->deleteJson(
            '/api/v1/admin/questions/'.$built['question']->getKey(),
            [],
            $this->adminCsrf(),
        )->assertStatus(405);

        $this->assertDatabaseHas('questions', ['id' => $built['question']->getKey()]);
    }

    public function test_a_chapter_from_another_subject_is_rejected(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $first = $this->makeContentTree();
        $second = $this->makeContentTree();

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions',
            $this->createPayload($first['subject']->getKey(), [
                'chapter_id' => $second['chapter']->getKey(),
            ]),
            $this->adminCsrf(),
        )
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonPath('error.fields.chapter_id.0', 'CHAPTER_SUBJECT_MISMATCH');

        $this->assertSame(0, Question::query()->count());
    }

    public function test_a_lesson_outside_the_given_chapter_is_rejected(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $first = $this->makeContentTree();
        $second = $this->makeContentTree();

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions',
            $this->createPayload($first['subject']->getKey(), [
                'chapter_id' => $first['chapter']->getKey(),
                'lesson_id' => $second['lesson']->getKey(),
            ]),
            $this->adminCsrf(),
        )
            ->assertStatus(422)
            ->assertJsonPath('error.fields.lesson_id.0', 'LESSON_CHAPTER_MISMATCH');
    }

    public function test_too_few_options_are_rejected(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $tree = $this->makeContentTree();

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions',
            $this->createPayload($tree['subject']->getKey(), [
                'options' => [['label' => '1', 'body' => 'تنها گزینه']],
            ]),
            $this->adminCsrf(),
        )->assertStatus(422)->assertFieldError('options');
    }

    public function test_a_correct_position_outside_the_option_range_is_rejected(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $tree = $this->makeContentTree();

        $this->postJsonWithOrigin(
            '/api/v1/admin/questions',
            $this->createPayload($tree['subject']->getKey(), [
                'key' => ['correctPosition' => 9],
            ]),
            $this->adminCsrf(),
        )
            ->assertStatus(422)
            ->assertJsonPath('error.fields.correctPosition.0', 'CORRECT_POSITION_OUT_OF_RANGE');
    }

    public function test_the_admin_list_can_filter_by_status_and_includes_the_key(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $published = $this->makeQuestion()['question'];
        $draft = $this->makeQuestion([], 1, 4, false)['question'];

        $drafts = $this->getJson('/api/v1/admin/questions?status=draft')
            ->assertOk()
            ->assertJsonCount(1, 'data.questions');

        $this->assertSame($draft->getKey(), $drafts->json('data.questions.0.id'));
        $this->assertNotNull($drafts->json('data.questions.0.key.correct_option_id'));

        $all = array_column($this->getJson('/api/v1/admin/questions')->assertOk()->json('data.questions'), 'id');

        $this->assertContains($published->getKey(), $all);
    }

    public function test_an_unknown_query_parameter_on_the_admin_list_is_rejected(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->getJson('/api/v1/admin/questions?includeAnswerKey=true')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    public function test_an_unknown_admin_question_is_404(): void
    {
        $this->seedRbac();
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->getJson('/api/v1/admin/questions/'.Str::uuid())
            ->assertStatus(404);
    }

    public function test_admin_login_failures_are_uniform(): void
    {
        $this->seedRbac();
        $admin = $this->makeAdmin('editor');

        $this->loginAdmin($admin, 'wrong-password')->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');

        $this->postJsonWithOrigin('/api/v1/admin/auth/login', [
            'username' => 'does-not-exist',
            'password' => 'whatever',
        ])->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
    }

    public function test_an_inactive_admin_cannot_log_in(): void
    {
        $this->seedRbac();
        $admin = $this->makeAdmin('editor');
        $admin->forceFill(['active' => false])->save();

        $this->loginAdmin($admin)->assertStatus(401);
    }
}
