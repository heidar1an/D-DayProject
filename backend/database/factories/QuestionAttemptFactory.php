<?php

namespace Database\Factories;

use App\Models\Question;
use App\Models\QuestionAttempt;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<QuestionAttempt> */
class QuestionAttemptFactory extends Factory
{
    protected $model = QuestionAttempt::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'guest_id' => null,
            'question_id' => Question::factory()->published(),
            'selected_option_id' => null,
            'is_correct' => false,
            'question_version' => 1,
            'time_spent_sec' => null,
            'answered_at' => now(),
        ];
    }

    public function correct(): static
    {
        return $this->state(fn (): array => ['is_correct' => true]);
    }
}
