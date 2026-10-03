<?php

namespace Database\Seeders;

use App\Models\Challenge;
use Illuminate\Database\Seeder;

/**
 * کاتالوگ چالش‌های روزانه/هفتگی — فقط تعریف واقعی، هیچ پیشرفت نمونه‌ای seed
 * نمی‌شود. metric باید از مجموعهٔ بستهٔ `Challenge::METRIC_*` باشد و فقط از
 * رخداد معتبر بک‌اند پیشرفت می‌گیرد. idempotent است.
 */
class ChallengeSeeder extends Seeder
{
    public function run(): void
    {
        /** @var list<array{code: string, name: string, description: string, kind: string, metric: string, target: int, xp_reward: int}> $rows */
        $rows = [
            [
                'code' => 'daily-lesson',
                'name' => 'یک درس در روز',
                'description' => 'امروز یک صفحهٔ درس را کامل کن.',
                'kind' => Challenge::KIND_DAILY,
                'metric' => Challenge::METRIC_LESSONS_COMPLETED,
                'target' => 1,
                'xp_reward' => 30,
            ],
            [
                'code' => 'daily-questions',
                'name' => 'پنج پاسخ درست',
                'description' => 'امروز پنج سؤال را درست جواب بده.',
                'kind' => Challenge::KIND_DAILY,
                'metric' => Challenge::METRIC_QUESTIONS_CORRECT,
                'target' => 5,
                'xp_reward' => 25,
            ],
            [
                'code' => 'daily-study-45',
                'name' => 'چهل‌وپنج دقیقه مطالعه',
                'description' => 'امروز ۴۵ دقیقه مطالعهٔ ثبت‌شده داشته باش.',
                'kind' => Challenge::KIND_DAILY,
                'metric' => Challenge::METRIC_STUDY_MINUTES,
                'target' => 45,
                'xp_reward' => 20,
            ],
            [
                'code' => 'weekly-lessons',
                'name' => 'ده درس در هفته',
                'description' => 'در این هفته ده صفحهٔ درس را کامل کن.',
                'kind' => Challenge::KIND_WEEKLY,
                'metric' => Challenge::METRIC_LESSONS_COMPLETED,
                'target' => 10,
                'xp_reward' => 120,
            ],
            [
                'code' => 'weekly-exam',
                'name' => 'یک آزمون در هفته',
                'description' => 'در این هفته یک آزمون را تمام کن.',
                'kind' => Challenge::KIND_WEEKLY,
                'metric' => Challenge::METRIC_EXAMS_FINISHED,
                'target' => 1,
                'xp_reward' => 100,
            ],
        ];

        foreach ($rows as $row) {
            Challenge::query()->updateOrCreate(
                ['code' => $row['code']],
                [...$row, 'status' => Challenge::STATUS_ACTIVE],
            );
        }
    }
}
