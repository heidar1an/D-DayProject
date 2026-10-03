<?php

namespace Database\Factories;

use App\Models\Question;
use App\Models\QuestionOption;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<QuestionOption> */
class QuestionOptionFactory extends Factory
{
    protected $model = QuestionOption::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'question_id' => Question::factory(),
            'position' => 1,
            'label' => null,
            'body' => 'گزینهٔ آزمایشی',
        ];
    }
}
