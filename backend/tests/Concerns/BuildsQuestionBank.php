<?php

namespace Tests\Concerns;

use App\Models\Chapter;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonPage;
use App\Models\Question;
use App\Models\QuestionKey;
use App\Models\QuestionOption;
use App\Models\Subject;
use Illuminate\Support\Collection;

/**
 * ساخت دادهٔ بانک سؤال برای تست‌ها — از مدل و دیتابیس، نه از endpoint ادمین.
 *
 * چرا نه از endpoint: تست خواندن/پاسخ نباید به CRUD ادمین وابسته باشد، وگرنه یک
 * شکست در ادمین همهٔ تست‌ها را قرمز می‌کند و علت واقعی گم می‌شود.
 */
trait BuildsQuestionBank
{
    /**
     * سؤال منتشرشده با گزینه‌ها و کلید.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{question: Question, options: Collection<int, QuestionOption>, correct: QuestionOption}
     */
    protected function makeQuestion(
        array $attributes = [],
        int $correctPosition = 1,
        int $optionCount = 4,
        bool $published = true,
    ): array {
        $factory = Question::factory();

        $question = ($published ? $factory->published() : $factory)->create($attributes);

        $options = collect();

        foreach (range(1, $optionCount) as $position) {
            $options->push(QuestionOption::factory()->create([
                'question_id' => $question->getKey(),
                'position' => $position,
                'label' => (string) $position,
                'body' => 'گزینهٔ شماره '.$position,
            ]));
        }

        /** @var QuestionOption $correct */
        $correct = $options->firstWhere('position', $correctPosition);

        $key = new QuestionKey;
        $key->forceFill([
            'question_id' => $question->getKey(),
            'correct_option_id' => $correct->getKey(),
            'explanation' => ['summary' => 'توضیح کوتاه', 'deep' => 'توضیح کامل'],
            'key_version' => 1,
        ])->save();

        $question->setRelation('options', $options);
        $question->setRelation('key', $key);

        return ['question' => $question, 'options' => $options, 'correct' => $correct];
    }

    /** گزینه‌ای که به این سؤال تعلق ندارد (برای تست تعلق گزینه). */
    protected function foreignOptionId(): string
    {
        return (string) $this->makeQuestion()['options']->first()->getKey();
    }

    /** زنجیرهٔ کامل منتشرشده: subject → course → chapter → lesson → page. */
    protected function makePublishedPage(): LessonPage
    {
        return LessonPage::factory()->published()->create();
    }

    /** صفحهٔ published زیر درس draft — «قابل مشاهده» نیست. */
    protected function makePageUnderDraftLesson(): LessonPage
    {
        $page = LessonPage::factory()->published()->create();

        Lesson::query()->whereKey($page->lesson_id)->update(['status' => Lesson::STATUS_DRAFT]);

        return $page->refresh();
    }

    /** صفحهٔ draft زیر درس published — «قابل مشاهده» نیست. */
    protected function makeDraftPage(): LessonPage
    {
        return LessonPage::factory()->create();
    }

    /**
     * ساختار محتوایی کامل و منتشرشده برای تست روابط سؤال.
     *
     * @return array{subject: Subject, course: Course, chapter: Chapter, lesson: Lesson, page: LessonPage}
     */
    protected function makeContentTree(): array
    {
        $page = LessonPage::factory()->published()->create();
        $page->load('lesson.chapter.course.subject');

        $lesson = $page->lesson;
        $chapter = $lesson->chapter;
        $course = $chapter->course;
        $subject = $course->subject;

        return compact('subject', 'course', 'chapter', 'lesson', 'page');
    }
}
