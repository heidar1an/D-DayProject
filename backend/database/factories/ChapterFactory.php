<?php

namespace Database\Factories;

use App\Models\Chapter;
use App\Models\Course;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Chapter> */
class ChapterFactory extends Factory
{
    protected $model = Chapter::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $slug = Str::slug(fake()->unique()->words(2, true)) ?: 'chapter';

        return [
            'course_id' => Course::factory()->published(),
            'slug' => 'chapter-'.$slug,
            'title' => 'فصل آزمایشی',
            'description' => null,
            'sort_order' => fake()->numberBetween(1, 20),
            'status' => Chapter::STATUS_DRAFT,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (): array => [
            'status' => Chapter::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
    }

    public function forCourse(Course $course): static
    {
        return $this->state(fn (): array => ['course_id' => $course->getKey()]);
    }
}
