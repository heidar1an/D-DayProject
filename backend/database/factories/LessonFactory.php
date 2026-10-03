<?php

namespace Database\Factories;

use App\Models\Chapter;
use App\Models\Lesson;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Lesson> */
class LessonFactory extends Factory
{
    protected $model = Lesson::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $slug = Str::slug(fake()->unique()->words(2, true)) ?: 'lesson';

        return [
            'chapter_id' => Chapter::factory()->published(),
            'slug' => 'lesson-'.$slug,
            'title' => 'درس آزمایشی',
            'description' => null,
            'sort_order' => fake()->numberBetween(1, 20),
            'status' => Lesson::STATUS_DRAFT,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (): array => [
            'status' => Lesson::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
    }

    public function forChapter(Chapter $chapter): static
    {
        return $this->state(fn (): array => ['chapter_id' => $chapter->getKey()]);
    }
}
