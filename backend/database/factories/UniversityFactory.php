<?php

namespace Database\Factories;

use App\Models\University;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<University> */
class UniversityFactory extends Factory
{
    protected $model = University::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'slug' => Str::lower(fake()->unique()->numerify('uni-####')),
            'name' => 'دانشگاه آزمایشی '.fake()->unique()->numerify('####'),
            'active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['active' => false]);
    }
}
