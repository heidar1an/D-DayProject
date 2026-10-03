<?php

namespace App\Services\Gamification;

use App\Models\Achievement;
use App\Models\GreenPathStep;
use App\Models\Streak;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * نشان‌ها — deterministic / idempotent / auditable (فاز ۱۴).
 *
 * شرط هر نشان فقط روی دادهٔ واقعی بک‌اند چک می‌شود (قدم‌های تکمیل‌شده، نتایج
 * آزمون، زنجیرهٔ مطالعه، دفتر XP). بازکردن روی UNIQUE(user_id, achievement_id)
 * سوار است؛ مسابقه ⇒ گرفتن Unique ⇒ «از قبل باز شده».
 * هیچ endpoint کلاینتی برای unlock وجود ندارد.
 */
class AchievementService
{
    public function evaluate(string $userId): int
    {
        return count($this->evaluateUnlocked($userId));
    }

    /**
     * همان ارزیابی، ولی نشان‌های **تازه‌باز‌شده** را برمی‌گرداند.
     *
     * چرا لازم شد (فاز ۱۹): اعلان «دستاورد باز شد» باید فقط برای نشان تازه
     * صادر شود، نه هر بار که ارزیابی اجرا می‌شود. `evaluate()` قبلی فقط تعداد
     * را می‌داد و تولیدکنندهٔ واقعی اعلان نمی‌توانست بداند کدام نشان باز شده.
     *
     * @return list<Achievement>
     */
    public function evaluateUnlocked(string $userId): array
    {
        $definitions = Achievement::query()->where('status', Achievement::STATUS_ACTIVE)->get();

        if ($definitions->isEmpty()) {
            return [];
        }

        $metrics = $this->metrics($userId);
        $unlocked = [];

        foreach ($definitions as $achievement) {
            if (! $this->satisfied((string) $achievement->code, $metrics)) {
                continue;
            }

            try {
                /*
                 * ⚠️ `DB::transaction` + گرفتن استثنا در **بیرون** آن.
                 *
                 * روی PostgreSQL هر دستور خطادار تراکنش جاری را aborted می‌کند.
                 * اگر خطا را داخل callback بگیریم، لاراول rollback نمی‌کند و هر
                 * دستور بعدی با `25P02` می‌شکند — و این متد از listener‌ای صدا
                 * زده می‌شود که بقیهٔ کارش را در همان تراکنش ادامه می‌دهد.
                 */
                DB::transaction(function () use ($userId, $achievement): void {
                    DB::table('user_achievements')->insert([
                        'id' => (string) Str::uuid(),
                        'user_id' => $userId,
                        'achievement_id' => $achievement->getKey(),
                        'unlocked_at' => now(),
                        'created_at' => now(),
                    ]);
                });

                $unlocked[] = $achievement;
            } catch (UniqueConstraintViolationException) {
                continue; /* از قبل باز — تکراری ثبت نمی‌شود. */
            }
        }

        return $unlocked;
    }

    /** @return array<string, mixed> فهرست چالش‌ها/نشان‌های کاربر برای API. */
    public function forUser(string $userId): array
    {
        $definitions = Achievement::query()->orderBy('code')->get();
        $unlocked = DB::table('user_achievements')
            ->where('user_id', $userId)
            ->pluck('unlocked_at', 'achievement_id');

        return $definitions->map(function (Achievement $achievement) use ($unlocked): array {
            $unlockedAt = $unlocked->get($achievement->getKey());

            return [
                'id' => $achievement->getKey(),
                'code' => $achievement->code,
                'name' => $achievement->name,
                'description' => $achievement->description,
                'status' => $achievement->status,
                'unlocked' => $unlockedAt !== null,
                'unlocked_at' => $unlockedAt !== null ? Carbon::parse($unlockedAt)->toIso8601String() : null,
            ];
        })->all();
    }

    /**
     * متریک‌های واقعی — هر کدام یک query اندازه‌گیری‌شده، نه حدس.
     *
     * @return array{completed_steps:int, exams_taken:int, streak:int, xp_total:int}
     */
    private function metrics(string $userId): array
    {
        $completedSteps = DB::table('green_path_steps as s')
            ->join('green_paths as p', 'p.id', '=', 's.path_id')
            ->where('p.user_id', $userId)
            ->where('s.status', GreenPathStep::STATUS_COMPLETED)
            ->count();

        $examsTaken = DB::table('exam_results')->where('user_id', $userId)->count();

        $streak = (int) (Streak::query()
            ->where('user_id', $userId)
            ->where('kind', Streak::KIND_STUDY)
            ->value('current_count') ?? 0);

        $xpTotal = (int) DB::table('xp_transactions')->where('user_id', $userId)->sum('delta');

        return [
            'completed_steps' => $completedSteps,
            'exams_taken' => $examsTaken,
            'streak' => $streak,
            'xp_total' => $xpTotal,
        ];
    }

    /**
     * @param  array{completed_steps:int, exams_taken:int, streak:int, xp_total:int}  $metrics
     */
    private function satisfied(string $code, array $metrics): bool
    {
        $thresholds = (array) config('gamification.achievements.thresholds');

        return match ($code) {
            'first_steps' => $metrics['completed_steps'] >= (int) ($thresholds['first_steps'] ?? 1),
            'steps_25' => $metrics['completed_steps'] >= (int) ($thresholds['steps_25'] ?? 25),
            'first_exam' => $metrics['exams_taken'] >= (int) ($thresholds['first_exam'] ?? 1),
            'exams_5' => $metrics['exams_taken'] >= (int) ($thresholds['exams_5'] ?? 5),
            'streak_7' => $metrics['streak'] >= (int) ($thresholds['streak_7'] ?? 7),
            'xp_1000' => $metrics['xp_total'] >= (int) ($thresholds['xp_1000'] ?? 1000),
            default => false, /* کد ناشناخته در دیتابیس ⇒ هرگز unlock نمی‌شود. */
        };
    }
}
