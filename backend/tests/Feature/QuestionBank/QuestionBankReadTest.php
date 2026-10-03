<?php

namespace Tests\Feature\QuestionBank;

use App\Models\Question;
use App\Models\QuestionTopic;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۶ — خواندن عمومی بانک سؤال.
 *
 * دو چیز اینجا تست می‌شود که مستقیماً قرارداد امنیتی‌اند:
 *   ۱. فقط `published` دیده می‌شود (draft/archived نه)؛
 *   ۲. فیلتر ناشناخته ۴۰۰ می‌گیرد، نه نادیده‌گرفتن بی‌صدا.
 */
class QuestionBankReadTest extends TestCase
{
    use BuildsQuestionBank, RefreshDatabase;

    public function test_the_list_is_public_and_only_returns_published_questions(): void
    {
        $published = $this->makeQuestion()['question'];
        $draft = $this->makeQuestion([], 1, 4, false)['question'];
        $archived = $this->makeQuestion()['question'];
        $archived->forceFill(['status' => Question::STATUS_ARCHIVED])->save();

        $response = $this->getJson('/api/v1/questions')->assertOk();

        $ids = array_column($response->json('data.questions'), 'id');

        $this->assertContains($published->getKey(), $ids);
        $this->assertNotContains($draft->getKey(), $ids);
        $this->assertNotContains($archived->getKey(), $ids);
    }

    public function test_the_list_is_paginated_and_carries_meta(): void
    {
        foreach (range(1, 5) as $ignored) {
            $this->makeQuestion();
        }

        $this->getJson('/api/v1/questions?perPage=2')
            ->assertOk()
            ->assertJsonCount(2, 'data.questions')
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('meta.perPage', 2)
            ->assertJsonPath('meta.total', 5)
            ->assertJsonPath('meta.lastPage', 3);
    }

    public function test_per_page_above_the_ceiling_is_rejected(): void
    {
        $max = (int) config('question_bank.pagination.max_per_page');

        $this->getJson('/api/v1/questions?perPage='.($max + 1))
            ->assertStatus(422)
            ->assertFieldError('perPage');
    }

    public function test_a_draft_question_is_404_on_the_detail_endpoint(): void
    {
        $draft = $this->makeQuestion([], 1, 4, false)['question'];

        // ۴۰۴ نه ۴۰۳: وجود پیش‌نویس نباید لو برود.
        $this->getJson('/api/v1/questions/'.$draft->getKey())
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_the_detail_endpoint_returns_options_in_position_order(): void
    {
        $built = $this->makeQuestion();

        $positions = array_column(
            $this->getJson('/api/v1/questions/'.$built['question']->getKey())->assertOk()->json('data.question.options'),
            'position',
        );

        $this->assertSame([1, 2, 3, 4], $positions);
    }

    public function test_an_unknown_filter_is_rejected_with_400(): void
    {
        $this->getJson('/api/v1/questions?status=draft')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    public function test_an_unknown_filter_on_the_detail_route_is_also_rejected(): void
    {
        $question = $this->makeQuestion()['question'];

        $this->getJson('/api/v1/questions/'.$question->getKey().'?includeAnswerKey=true')
            ->assertStatus(400)
            ->assertJsonPath('error.code', 'UNKNOWN_QUERY_PARAMETER');
    }

    public function test_filters_are_allowlisted_and_actually_apply(): void
    {
        $easy = $this->makeQuestion(['difficulty' => 'easy'])['question'];
        $hard = $this->makeQuestion(['difficulty' => 'hard'])['question'];

        $ids = array_column(
            $this->getJson('/api/v1/questions?difficulty=easy')->assertOk()->json('data.questions'),
            'id',
        );

        $this->assertSame([$easy->getKey()], $ids);
        $this->assertNotContains($hard->getKey(), $ids);
    }

    public function test_an_invalid_enum_value_is_rejected(): void
    {
        $this->getJson('/api/v1/questions?difficulty=impossible')
            ->assertStatus(422)
            ->assertFieldError('difficulty');
    }

    public function test_a_topic_filter_includes_child_topics(): void
    {
        $tree = $this->makeContentTree();

        $parent = QuestionTopic::factory()->create([
            'subject_id' => $tree['subject']->getKey(),
            'slug' => 'parent-topic',
        ]);

        $child = QuestionTopic::factory()->childOf($parent)->create(['slug' => 'child-topic']);

        $onParent = $this->makeQuestion([
            'subject_id' => $tree['subject']->getKey(),
            'topic_id' => $parent->getKey(),
        ])['question'];

        $onChild = $this->makeQuestion([
            'subject_id' => $tree['subject']->getKey(),
            'topic_id' => $child->getKey(),
        ])['question'];

        $unrelated = $this->makeQuestion(['subject_id' => $tree['subject']->getKey()])['question'];

        $ids = array_column(
            $this->getJson('/api/v1/questions?topic=parent-topic')->assertOk()->json('data.questions'),
            'id',
        );

        $this->assertContains($onParent->getKey(), $ids);
        $this->assertContains($onChild->getKey(), $ids);
        $this->assertNotContains($unrelated->getKey(), $ids);
    }

    public function test_search_matches_the_stem_and_ignores_wildcards_from_the_client(): void
    {
        $match = $this->makeQuestion(['stem' => 'بیمار با تب و لرز مراجعه کرده است'])['question'];
        $other = $this->makeQuestion(['stem' => 'تقسیم سلولی در بافت پوششی'])['question'];

        $ids = array_column(
            $this->getJson('/api/v1/questions?q='.rawurlencode('تب و لرز'))->assertOk()->json('data.questions'),
            'id',
        );

        $this->assertSame([$match->getKey()], $ids);
        $this->assertNotContains($other->getKey(), $ids);

        /*
         * `%` کلاینت نباید wildcard شود. سرویس `%`, `_` و `\` را escape می‌کند؛
         * نتیجهٔ قابل‌مشاهده در هر دو درایور یکی است: هیچ سؤالی برنمی‌گردد.
         * (روی PostgreSQL escape پیش‌فرض `\` است؛ روی SQLite الگوی escape‌شده
         * هیچ رکوردی پیدا نمی‌کند. هر دو یعنی «کلاینت نمی‌تواند همه را بگیرد».)
         */
        $this->getJson('/api/v1/questions?q=%25')->assertOk()->assertJsonCount(0, 'data.questions');
    }

    public function test_sort_oldest_returns_the_earliest_published_first(): void
    {
        $older = $this->makeQuestion()['question'];
        $older->forceFill(['published_at' => now()->subDays(10)])->save();

        $newer = $this->makeQuestion()['question'];
        $newer->forceFill(['published_at' => now()->subDay()])->save();

        $ids = array_column(
            $this->getJson('/api/v1/questions?sort=oldest')->assertOk()->json('data.questions'),
            'id',
        );

        $this->assertSame([$older->getKey(), $newer->getKey()], $ids);
    }

    public function test_an_invalid_sort_is_rejected(): void
    {
        $this->getJson('/api/v1/questions?sort=random')
            ->assertStatus(422)
            ->assertFieldError('sort');
    }

    public function test_a_guest_can_read_the_bank(): void
    {
        $this->makeQuestion();

        $this->getJson('/api/v1/questions')->assertOk();
    }
}
