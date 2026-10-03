<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\Subject;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Course> */
class CourseFactory extends Factory
{
    protected $model = Course::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $slug = Str::slug(fake()->unique()->words(2, true)) ?: 'course';

        return [
            'subject_id' => Subject::factory()->published(),
            'slug' => 'course-'.$slug,
            'title' => 'دورهٔ آزمایشی',
            'description' => null,
            'sort_order' => fake()->numberBetween(1, 20),
            'status' => Course::STATUS_DRAFT,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (): array => [
            'status' => Course::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
    }

    public function forSubject(Subject $subject): static
    {
        return $this->state(fn (): array => ['subject_id' => $subject->getKey()]);
    }
}
