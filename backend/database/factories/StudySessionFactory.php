<?php

namespace Database\Factories;

use App\Models\StudySession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<StudySession> */
class StudySessionFactory extends Factory
{
    protected $model = StudySession::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $startedAt = now()->subMinutes(30);

        return [
            'user_id' => User::factory(),
            'lesson_page_id' => null,
            'source' => StudySession::SOURCE_LESSON,
            'started_at' => $startedAt,
            'ended_at' => $startedAt->copy()->addMinutes(20),
            'duration_sec' => 1200,
        ];
    }
}
