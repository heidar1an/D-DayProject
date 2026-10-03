<?php

namespace Database\Factories;

use App\Models\Question;
use App\Models\Subject;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Question> */
class QuestionFactory extends Factory
{
    protected $model = Question::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'subject_id' => Subject::factory()->published(),
            'chapter_id' => null,
            'lesson_id' => null,
            'topic_id' => null,
            'stem' => 'متن سؤال آزمایشی؟',
            'figure_key' => null,
            'type' => 'single',
            'difficulty' => 'medium',
            'source' => 'tapesh',
            'track' => 'medicine',
            'year' => null,
            'exam_month' => null,
            'status' => Question::STATUS_DRAFT,
            'version' => 1,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (): array => [
            'status' => Question::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
    }

    public function archived(): static
    {
        return $this->state(fn (): array => ['status' => Question::STATUS_ARCHIVED]);
    }
}
