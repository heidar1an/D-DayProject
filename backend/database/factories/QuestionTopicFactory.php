<?php

namespace Database\Factories;

use App\Models\QuestionTopic;
use App\Models\Subject;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<QuestionTopic> */
class QuestionTopicFactory extends Factory
{
    protected $model = QuestionTopic::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $slug = Str::slug(fake()->unique()->words(2, true)) ?: 'topic';

        return [
            'subject_id' => Subject::factory()->published(),
            'parent_id' => null,
            'slug' => 'topic-'.$slug,
            'title' => 'مبحث آزمایشی',
            'sort_order' => fake()->numberBetween(1, 20),
            'status' => QuestionTopic::STATUS_PUBLISHED,
        ];
    }

    public function childOf(QuestionTopic $parent): static
    {
        return $this->state(fn (): array => [
            'subject_id' => $parent->subject_id,
            'parent_id' => $parent->getKey(),
        ]);
    }
}
