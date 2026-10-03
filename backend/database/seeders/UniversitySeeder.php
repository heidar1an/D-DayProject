<?php

namespace Database\Seeders;

use App\Models\University;
use Illuminate\Database\Seeder;

/**
 * دانشگاه‌های واقعی پروژه — ۶۱ مورد از `database/seeders/data/universities.php`
 * (منبع اصلی: `src/services/league/mockData.js`).
 *
 * idempotent است: اجرای دوباره ردیف تکراری نمی‌سازد. هیچ دادهٔ ساختگی تولید
 * نمی‌شود و همهٔ ردیف‌ها `active` هستند؛ غیرفعال‌کردن یک دانشگاه تصمیم عملیاتی
 * است، نه seed.
 */
class UniversitySeeder extends Seeder
{
    public function run(): void
    {
        /** @var list<array{slug: string, name: string}> $rows */
        $rows = require database_path('seeders/data/universities.php');

        foreach ($rows as $row) {
            University::query()->updateOrCreate(
                ['slug' => $row['slug']],
                ['name' => $row['name'], 'active' => true],
            );
        }
    }
}
