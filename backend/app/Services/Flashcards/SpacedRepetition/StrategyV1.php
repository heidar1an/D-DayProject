<?php

namespace App\Services\Flashcards\SpacedRepetition;

use App\Models\FlashcardState;
use Carbon\CarbonImmutable;

/**
 * نسخهٔ ۱ الگوریتم — پورت دقیق `src/services/flashcards/spacedRepetition.js`.
 *
 * چرا پورت «دقیق» و نه «بهبودیافته»: اگر منطق سرور و کلاینت فرق کند، هر مروری
 * که تا امروز در localStorage ثبت شده معنایش عوض می‌شود. این نسخه همان SM-2
 * سبک Anki است با گام‌های یادگیری، ease و بازپروری.
 *
 * ⚠️ هیچ ورودی‌ای از کلاینت اینجا اثر ندارد: فقط `rating` و وضعیت **ذخیره‌شده**.
 * `interval`/`ease`/`due_at` همه خروجی این تابع‌اند.
 */
final class StrategyV1 implements SpacedRepetitionStrategy
{
    public const VERSION = 'sm2-tapesh-v1';

    private const MINUTES_PER_DAY = 1440;

    /** @var array<string, mixed> */
    private array $config;

    /** @param array<string, mixed>|null $config */
    public function __construct(?array $config = null)
    {
        /** @var array<string, mixed> $defaults */
        $defaults = config('flashcards.algorithm.v1', []);
        $this->config = $config === null ? $defaults : [...$defaults, ...$config];
    }

    public function version(): string
    {
        return self::VERSION;
    }

    public function schedule(FlashcardState $state, string $rating, CarbonImmutable $now): ReviewComputation
    {
        $previousState = (string) ($state->state ?? FlashcardState::STATE_NEW);
        $previousInterval = (int) ($state->interval_minutes ?? 0);
        $previousEase = $this->float($state->ease, $this->float($this->config['starting_ease'], 2.5));
        $previousDifficulty = $this->float($state->difficulty, 0.3);
        $learningStep = (int) ($state->learning_step ?? 0);

        $ease = $previousEase;
        $intervalMinutes = 0;

        if ($rating === 'again') {
            // Lapse — کارت به ابتدای چرخهٔ یادگیری مجدد برمی‌گردد.
            $ease = $this->clamp($previousEase - $this->float($this->config['lapse_ease_penalty'], 0.2), $this->float($this->config['min_ease'], 1.3), 5.0);
            $learningStep = 0;
            $nextState = FlashcardState::STATE_RELEARNING;
            $intervalMinutes = $this->stepDuration($this->steps('relearning_steps_minutes'), 0);
        } elseif ($this->isLearningState($previousState) || $previousState === FlashcardState::STATE_NEW) {
            $steps = $previousState === FlashcardState::STATE_RELEARNING
                ? $this->steps('relearning_steps_minutes')
                : $this->steps('learning_steps_minutes');

            if ($rating === 'hard') {
                $intervalMinutes = $this->stepDuration($steps, $learningStep);
                $nextState = $previousState === FlashcardState::STATE_NEW
                    ? FlashcardState::STATE_LEARNING
                    : $previousState;
                // «hard» در گام یادگیری حداقل ۶ دقیقه فاصله می‌دهد.
                $intervalMinutes = max($intervalMinutes, 6);
            } elseif ($rating === 'good') {
                $learningStep += 1;

                if ($learningStep >= count($steps)) {
                    $nextState = FlashcardState::STATE_REVIEW;
                    $intervalMinutes = (int) round($this->float($this->config['graduating_interval_days'], 4) * self::MINUTES_PER_DAY);
                } else {
                    $nextState = $previousState === FlashcardState::STATE_NEW
                        ? FlashcardState::STATE_LEARNING
                        : $previousState;
                    $intervalMinutes = $this->stepDuration($steps, $learningStep);
                }
            } else {
                // easy — پرش مستقیم به مرور عادی.
                $nextState = FlashcardState::STATE_REVIEW;
                $intervalMinutes = (int) round($this->float($this->config['easy_interval_days'], 10) * self::MINUTES_PER_DAY);
            }
        } else {
            // حالت مرور عادی — SM-2 روی فاصلهٔ فعلی.
            $currentDays = max($previousInterval / self::MINUTES_PER_DAY, 1.0);

            if ($rating === 'hard') {
                $ease = $this->clamp($previousEase - 0.15, $this->float($this->config['min_ease'], 1.3), 5.0);
                $factor = $this->float($this->config['hard_factor'], 1.2);
            } elseif ($rating === 'good') {
                $factor = 1.0; // رشد واقعی = ease
            } else {
                $ease = $this->clamp($previousEase + 0.1, $this->float($this->config['min_ease'], 1.3), 5.0);
                $factor = $this->float($this->config['easy_bonus'], 1.3);
            }

            $grown = $rating === 'good' ? $currentDays * $ease : $currentDays * $factor;
            $graduating = $this->float($this->config['graduating_interval_days'], 4);
            $baseDays = ((int) ($state->review_count ?? 0)) <= 1 && $rating !== 'hard'
                ? $graduating
                : max($grown, $graduating);

            $days = (int) $this->clamp(
                round($baseDays * $this->float($this->config['interval_modifier'], 1.0)),
                1,
                $this->float($this->config['max_interval_days'], 365),
            );

            $nextState = FlashcardState::STATE_REVIEW;
            $intervalMinutes = $days * self::MINUTES_PER_DAY;
        }

        $reviewCount = (int) ($state->review_count ?? 0) + 1;
        $lapseCount = (int) ($state->lapse_count ?? 0) + ($rating === 'again' ? 1 : 0);
        $correctCount = (int) ($state->correct_count ?? 0) + ($rating === 'again' ? 0 : 1);
        $incorrectCount = (int) ($state->incorrect_count ?? 0) + ($rating === 'again' ? 1 : 0);

        $difficulty = $this->clamp(
            $previousDifficulty + match ($rating) {
                'again' => 0.12,
                'hard' => 0.06,
                'easy' => -0.06,
                default => 0.0,
            },
            0.0,
            1.0,
        );

        $intervalDays = $intervalMinutes / self::MINUTES_PER_DAY;

        /*
         * تسلط با همان فرمول فرانت‌اند محاسبه می‌شود و با `lastReviewedAt` **قبلی**
         * (نه این مرور) — عیناً مثل `rate()` در JS. تغییر این جزئیات یعنی عدد
         * تسلط کاربر بین کلاینت و سرور فرق کند.
         */
        $masteryScore = $this->mastery([
            'state' => $nextState,
            'interval_minutes' => $intervalMinutes,
            'review_count' => $reviewCount,
            'correct_count' => $correctCount,
            'lapse_count' => $lapseCount,
            'difficulty' => $difficulty,
            'last_reviewed_at' => $state->last_reviewed_at,
        ], $now);

        return new ReviewComputation(
            state: $nextState,
            dueAt: $now->addMinutes($intervalMinutes),
            intervalMinutes: $intervalMinutes,
            intervalDays: round($intervalDays, 3),
            ease: round($ease, 2),
            learningStep: $this->isLearningState($nextState) ? $learningStep : 0,
            difficulty: round($difficulty, 3),
            stability: round($this->clamp($intervalDays, 0, $this->float($this->config['max_interval_days'], 365)), 3),
            masteryScore: $masteryScore,
            reviewCount: $reviewCount,
            lapseCount: $lapseCount,
            correctCount: $correctCount,
            incorrectCount: $incorrectCount,
        );
    }

    /**
     * امتیاز تسلط ۰..۱۰۰ — ترکیب صحت، ماندگاری، حجم مرور و تازگی.
     *
     * @param  array<string, mixed>  $state
     */
    private function mastery(array $state, CarbonImmutable $now): int
    {
        if (($state['state'] ?? null) === FlashcardState::STATE_NEW) {
            return 0;
        }

        if (($state['state'] ?? null) === FlashcardState::STATE_MASTERED) {
            return 100;
        }

        $reviews = max(1, (int) ($state['review_count'] ?? 1));
        $accuracy = ((int) ($state['correct_count'] ?? 0)) / $reviews;
        $stability = $this->clamp(((int) ($state['interval_minutes'] ?? 0)) / (60 * 24 * 30), 0, 1);
        $lapses = $this->clamp(((int) ($state['lapse_count'] ?? 0)) / $reviews, 0, 1);
        $difficultyPenalty = $this->float($state['difficulty'] ?? 0, 0) * 0.15;

        $lastReviewedAt = $state['last_reviewed_at'] ?? null;
        $daysSinceReview = $lastReviewedAt instanceof \DateTimeInterface
            ? ($now->getTimestamp() - $lastReviewedAt->getTimestamp()) / 86400
            : 0.0;

        $recency = $this->clamp(1 - $daysSinceReview / 60, 0, 1);

        $raw = $accuracy * 55 + $stability * 30 + $recency * 15 - $lapses * 10 - $difficultyPenalty;

        return (int) round($this->clamp($raw, 0, 100));
    }

    /** @return list<int> */
    private function steps(string $key): array
    {
        /** @var list<int> $steps */
        $steps = (array) ($this->config[$key] ?? []);

        return array_values(array_map('intval', $steps));
    }

    /** @param list<int> $steps */
    private function stepDuration(array $steps, int $index): int
    {
        $minutes = $steps[$index] ?? null;

        if ($minutes === null) {
            return (int) round($this->float($this->config['graduating_interval_days'], 4) * self::MINUTES_PER_DAY);
        }

        return (int) $minutes;
    }

    private function isLearningState(string $state): bool
    {
        return $state === FlashcardState::STATE_LEARNING || $state === FlashcardState::STATE_RELEARNING;
    }

    private function clamp(float $value, float $min, float $max): float
    {
        return min($max, max($min, $value));
    }

    private function float(mixed $value, float $fallback): float
    {
        return is_numeric($value) ? (float) $value : $fallback;
    }
}
