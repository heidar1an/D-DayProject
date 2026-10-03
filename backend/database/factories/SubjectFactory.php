<?php

namespace Database\Factories;

use App\Models\Subject;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Subject> */
class SubjectFactory extends Factory
{
    protected $model = Subject::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $slug = Str::slug(fake()->unique()->words(2, true)) ?: 'subject';

        return [
            'slug' => 'subj-'.$slug,
            'title' => 'درس آزمایشی',
            'description' => null,
            'sort_order' => fake()->numberBetween(1, 20),
            'status' => Subject::STATUS_DRAFT,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (): array => [
            'status' => Subject::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
    }

    public function archived(): static
    {
        return $this->state(fn (): array => ['status' => Subject::STATUS_ARCHIVED]);
    }
}
