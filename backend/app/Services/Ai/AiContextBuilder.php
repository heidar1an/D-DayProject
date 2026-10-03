<?php

namespace App\Services\Ai;

use App\Models\User;
use App\Services\Analytics\OverviewAnalyticsService;

/** Educational aggregate only: no raw attempts, identity, health records or admin metadata. */
final class AiContextBuilder
{
    public function __construct(private readonly OverviewAnalyticsService $analytics) {}

    /** @return array<string, mixed> */
    public function build(User $user, string $mode): array
    {
        if (! in_array($mode, ['study', 'quiz'], true)) {
            return ['purpose' => 'educational_mentoring'];
        }

        $overview = $this->analytics->build($user);

        return [
            'purpose' => 'educational_mentoring',
            'learning' => [
                'completed_pages' => $overview['learning']['completed_pages'],
                'completed_lessons' => $overview['learning']['completed_lessons'],
            ],
            'questions' => ['accuracy' => $overview['questions']['accuracy']],
            'exams' => ['graded' => $overview['exams']['graded'], 'average_score' => $overview['exams']['average_score']],
        ];
    }
}
