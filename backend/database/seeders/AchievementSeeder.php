<?php

namespace Database\Seeders;

use App\Models\Achievement;
use Illuminate\Database\Seeder;

/**
 * کاتالوگ نشان‌ها — فقط تعریف واقعی، هیچ کاربر نمونه‌ای seed نمی‌شود.
 *
 * هر `code` باید در `AchievementService::satisfied()` شرط معادل داشته باشد؛
 * کد بدون شرط هرگز باز نمی‌شود (deny-by-default). idempotent است.
 */
class AchievementSeeder extends Seeder
{
    public function run(): void
    {
        /** @var list<array{code: string, name: string, description: string}> $rows */
        $rows = [
            [
                'code' => 'first_steps',
                'name' => 'اولین قدم',
                'description' => 'اولین قدم مسیر سبز را کامل کردی.',
            ],
            [
                'code' => 'steps_25',
                'name' => 'بیست‌وپنج قدم',
                'description' => 'بیست‌وپنج قدم مسیر سبز را کامل کردی.',
            ],
            [
                'code' => 'first_exam',
                'name' => 'اولین آزمون',
                'description' => 'اولین آزمون را تمام و نتیجه گرفتی.',
            ],
            [
                'code' => 'exams_5',
                'name' => 'پنج آزمون',
                'description' => 'پنج آزمون را تمام و نتیجه گرفتی.',
            ],
            [
                'code' => 'streak_7',
                'name' => 'هفت روز پیوسته',
                'description' => 'هفت روز پیوسته مطالعهٔ فعال داشتی.',
            ],
            [
                'code' => 'xp_1000',
                'name' => 'هزار امتیاز',
                'description' => 'مجموع ۱۰۰۰ امتیاز XP کسب کردی.',
            ],
        ];

        foreach ($rows as $row) {
            Achievement::query()->updateOrCreate(
                ['code' => $row['code']],
                ['name' => $row['name'], 'description' => $row['description'], 'status' => Achievement::STATUS_ACTIVE],
            );
        }
    }
}
