<?php

namespace Database\Factories;

use App\Models\LearningProgress;
use App\Models\LessonPage;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<LearningProgress> */
class LearningProgressFactory extends Factory
{
    protected $model = LearningProgress::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'lesson_page_id' => LessonPage::factory()->published(),
            'status' => LearningProgress::STATUS_IN_PROGRESS,
            'last_position' => null,
            'seconds_spent' => 0,
            'version' => 1,
            'completed_at' => null,
        ];
    }

    public function completed(): static
    {
        return $this->state(fn (): array => [
            'status' => LearningProgress::STATUS_COMPLETED,
            'completed_at' => now(),
        ]);
    }
}
