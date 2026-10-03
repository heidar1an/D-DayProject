<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * ترتیب مهم است: `universities` مرجع `user_profiles.university_id` است و
     * نقش/مجوزها پیش از هر ادمین واقعی باید وجود داشته باشند.
     *
     * ⚠️ هیچ کاربر و هیچ ادمین نمونه‌ای seed نمی‌شود: ساخت حساب آزمایشی با رمز
     * مشخص، یک حساب قابل‌حدس در هر محیطی است. کاربر با ثبت‌نام و ادمین با
     * `php artisan tapesh:admin:create` ساخته می‌شود.
     */
    public function run(): void
    {
        $this->call([
            UniversitySeeder::class,
            AdminRbacSeeder::class,
            // فاز ۱۴: کاتالوگ نشان‌ها/چالش‌ها — فقط تعریف؛ هیچ دادهٔ نمونه‌ای.
            AchievementSeeder::class,
            ChallengeSeeder::class,
        ]);
    }
}
