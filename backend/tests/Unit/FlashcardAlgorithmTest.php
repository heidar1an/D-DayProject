<?php

namespace Tests\Unit;

use App\Exceptions\ApiErrorException;
use App\Models\FlashcardState;
use App\Services\Flashcards\SpacedRepetition\SpacedRepetitionRegistry;
use App\Services\Flashcards\SpacedRepetition\StrategyV1;
use Carbon\CarbonImmutable;
use Tests\TestCase;

/**
 * وفاداری پورت الگوریتم Spaced Repetition — فاز ۹.
 *
 * چرا این تست مهم است: `StrategyV1` یک پورت از `spacedRepetition.js` است. اگر
 * عددی اینجا تغییر کند، معنای همهٔ مرورهایی که تا امروز در مرورگر ثبت شده
 * عوض می‌شود. این تست همان اعداد را قفل می‌کند.
 *
 * مرز اعتماد: ورودی تابع فقط `rating` و وضعیت **ذخیره‌شده** است؛ هیچ‌کدام از
 * `interval`/`ease`/`due_at` از بیرون قابل‌تنظیم نیستند — خروجی‌اند.
 */
class FlashcardAlgorithmTest extends TestCase
{
    private const DAY = 1440;

    private function state(array $attributes = []): FlashcardState
    {
        $state = new FlashcardState;
        $state->forceFill([
            'algorithm_version' => StrategyV1::VERSION,
            'state' => FlashcardState::STATE_NEW,
            'interval_days' => 0,
            'interval_minutes' => 0,
            'ease' => 2.5,
            'review_count' => 0,
            'lapse_count' => 0,
            'correct_count' => 0,
            'incorrect_count' => 0,
            'learning_step' => 0,
            'difficulty' => 0.3,
            'stability' => 0,
            'mastery_score' => 0,
            'suspended' => false,
            'last_reviewed_at' => null,
            ...$attributes,
        ]);

        return $state;
    }

    private function strategy(): StrategyV1
    {
        return new StrategyV1;
    }

    // ── کارت نو ─────────────────────────────────────────────────────────

    public function test_a_new_card_rated_good_advances_to_the_second_learning_step(): void
    {
        $now = CarbonImmutable::parse('2026-10-03 10:00:00');

        $result = $this->strategy()->schedule($this->state(), 'good', $now);

        $this->assertSame(FlashcardState::STATE_LEARNING, $result->state);
        /*
         * معنای Anki‌مانند: از گام ۰ با «good» به گام **بعدی** می‌رود، پس فاصلهٔ
         * بعدی = گام دوم = ۱ روز (۱۴۴۰ دقیقه). این عدد عیناً از
         * `stepDuration(config, steps, learningStep)` در JS می‌آید.
         */
        $this->assertSame(self::DAY, $result->intervalMinutes);
        $this->assertSame($now->addMinutes(self::DAY)->toIso8601String(), $result->dueAt->toIso8601String());
        $this->assertSame(1, $result->reviewCount);
        $this->assertSame(0, $result->lapseCount);
    }

    public function test_the_second_good_on_a_learning_card_graduates_it_to_review(): void
    {
        $now = CarbonImmutable::parse('2026-10-03 10:00:00');

        $result = $this->strategy()->schedule($this->state([
            'state' => FlashcardState::STATE_LEARNING,
            'learning_step' => 1,
            'interval_minutes' => self::DAY,
            'review_count' => 1,
        ]), 'good', $now);

        $this->assertSame(FlashcardState::STATE_REVIEW, $result->state);
        // بازهٔ فارغ‌التحصیلی ۴ روز است.
        $this->assertSame(4 * self::DAY, $result->intervalMinutes);
        $this->assertSame(4.0, $result->intervalDays);
    }

    public function test_easy_on_a_new_card_skips_straight_to_review_with_the_easy_interval(): void
    {
        $result = $this->strategy()->schedule($this->state(), 'easy', CarbonImmutable::now());

        $this->assertSame(FlashcardState::STATE_REVIEW, $result->state);
        // بازهٔ easy = ۱۰ روز.
        $this->assertSame(10 * self::DAY, $result->intervalMinutes);
    }

    public function test_hard_on_a_new_card_keeps_it_in_learning(): void
    {
        $result = $this->strategy()->schedule($this->state(), 'hard', CarbonImmutable::now());

        $this->assertSame(FlashcardState::STATE_LEARNING, $result->state);
        $this->assertGreaterThanOrEqual(6, $result->intervalMinutes);
        $this->assertLessThan(4 * self::DAY, $result->intervalMinutes);
    }

    // ── کارت در حالت مرور ────────────────────────────────────────────────

    public function test_good_grows_the_interval_by_the_ease_factor(): void
    {
        // ۴ روز، ease ۲.۵ ⇒ ۱۰ روز.
        $result = $this->strategy()->schedule($this->state([
            'state' => FlashcardState::STATE_REVIEW,
            'interval_days' => 4,
            'interval_minutes' => 4 * self::DAY,
            'review_count' => 2,
        ]), 'good', CarbonImmutable::now());

        $this->assertSame(FlashcardState::STATE_REVIEW, $result->state);
        $this->assertSame(10 * self::DAY, $result->intervalMinutes);
        $this->assertSame(2.5, $result->ease);
    }

    public function test_hard_reduces_the_ease_and_grows_slower_than_good(): void
    {
        $base = $this->state([
            'state' => FlashcardState::STATE_REVIEW,
            'interval_days' => 10,
            'interval_minutes' => 10 * self::DAY,
            'review_count' => 3,
        ]);

        $hard = $this->strategy()->schedule(clone $base, 'hard', CarbonImmutable::now());
        $good = $this->strategy()->schedule(clone $base, 'good', CarbonImmutable::now());

        $this->assertSame(2.35, $hard->ease);
        $this->assertLessThan($good->intervalMinutes, $hard->intervalMinutes);
    }

    public function test_easy_increases_the_ease_and_the_interval(): void
    {
        $base = $this->state([
            'state' => FlashcardState::STATE_REVIEW,
            'interval_days' => 10,
            'interval_minutes' => 10 * self::DAY,
            'review_count' => 3,
        ]);

        $easy = $this->strategy()->schedule(clone $base, 'easy', CarbonImmutable::now());

        $this->assertSame(2.6, $easy->ease);
        $this->assertGreaterThan(10 * self::DAY, $easy->intervalMinutes);
    }

    // ── Lapse و آستانه‌ها ───────────────────────────────────────────────

    public function test_again_lapses_the_card_into_relearning_and_penalises_the_ease(): void
    {
        $result = $this->strategy()->schedule($this->state([
            'state' => FlashcardState::STATE_REVIEW,
            'interval_days' => 20,
            'interval_minutes' => 20 * self::DAY,
            'review_count' => 5,
            'correct_count' => 5,
        ]), 'again', CarbonImmutable::now());

        $this->assertSame(FlashcardState::STATE_RELEARNING, $result->state);
        $this->assertSame(10, $result->intervalMinutes);
        $this->assertSame(2.3, $result->ease);
        $this->assertSame(1, $result->lapseCount);
        $this->assertSame(1, $result->incorrectCount);
        $this->assertSame(5, $result->correctCount);
    }

    public function test_the_ease_never_falls_below_the_floor(): void
    {
        $result = $this->strategy()->schedule($this->state([
            'state' => FlashcardState::STATE_REVIEW,
            'interval_minutes' => 5 * self::DAY,
            'ease' => 1.35,
            'review_count' => 4,
        ]), 'again', CarbonImmutable::now());

        // ۱.۳۵ − ۰.۲ = ۱.۱۵ ⇒ کف ۱.۳
        $this->assertSame(1.3, $result->ease);
    }

    public function test_the_interval_never_exceeds_the_maximum(): void
    {
        $result = $this->strategy()->schedule($this->state([
            'state' => FlashcardState::STATE_REVIEW,
            'interval_days' => 300,
            'interval_minutes' => 300 * self::DAY,
            'review_count' => 9,
        ]), 'good', CarbonImmutable::now());

        $this->assertSame(365 * self::DAY, $result->intervalMinutes);
        $this->assertSame(365.0, $result->intervalDays);
    }

    public function test_the_difficulty_stays_within_zero_and_one(): void
    {
        $state = $this->state(['state' => FlashcardState::STATE_REVIEW, 'interval_minutes' => self::DAY, 'difficulty' => 0.98]);

        $result = $this->strategy()->schedule($state, 'again', CarbonImmutable::now());

        $this->assertLessThanOrEqual(1.0, $result->difficulty);
        $this->assertGreaterThanOrEqual(0.0, $result->difficulty);
    }

    public function test_the_mastery_score_is_bounded_and_grows_with_successful_reviews(): void
    {
        $low = $this->strategy()->schedule($this->state([
            'state' => FlashcardState::STATE_LEARNING,
            'learning_step' => 1,
            'interval_minutes' => self::DAY,
            'review_count' => 1,
        ]), 'good', CarbonImmutable::now());

        $high = $this->strategy()->schedule($this->state([
            'state' => FlashcardState::STATE_REVIEW,
            'interval_days' => 60,
            'interval_minutes' => 60 * self::DAY,
            'review_count' => 8,
            'correct_count' => 8,
            'last_reviewed_at' => CarbonImmutable::now()->subDay(),
        ]), 'good', CarbonImmutable::now());

        $this->assertGreaterThanOrEqual(0, $low->masteryScore);
        $this->assertLessThanOrEqual(100, $high->masteryScore);
        $this->assertGreaterThan($low->masteryScore, $high->masteryScore);
    }

    public function test_the_algorithm_never_reads_client_supplied_scheduling_values(): void
    {
        /*
         * همان وضعیت، دو بار: بار دوم با مقادیری که «کلاینت فرضی» ممکن است
         * بخواهد تحمیل کند. تابع فقط وضعیت ذخیره‌شده را می‌خواند، پس خروجی
         * باید یکسان بماند.
         */
        $now = CarbonImmutable::parse('2026-10-03 10:00:00');

        $first = $this->strategy()->schedule($this->state(), 'good', $now);

        $poisoned = $this->state();
        $poisoned->setRawAttributes([
            ...$poisoned->getAttributes(),
            'next_due_at' => '2030-01-01 00:00:00',
            'interval' => 999,
            'ease' => 4.9,
        ], true);

        $second = $this->strategy()->schedule($poisoned, 'good', $now);

        $this->assertSame($first->intervalMinutes, $second->intervalMinutes);
        $this->assertSame($first->dueAt->toIso8601String(), $second->dueAt->toIso8601String());
    }

    // ── رجیستری ─────────────────────────────────────────────────────────

    public function test_the_registry_resolves_the_default_version(): void
    {
        $registry = app(SpacedRepetitionRegistry::class);

        $this->assertTrue($registry->supports(StrategyV1::VERSION));
        $this->assertContains(StrategyV1::VERSION, $registry->versions());
        $this->assertSame(StrategyV1::VERSION, $registry->default()->version());
    }

    public function test_an_unknown_algorithm_version_fails_explicitly(): void
    {
        $this->expectException(ApiErrorException::class);

        try {
            app(SpacedRepetitionRegistry::class)->for('sm2-tapesh-v99');
        } catch (ApiErrorException $e) {
            $this->assertSame('ALGORITHM_VERSION_UNKNOWN', $e->errorCode);
            $this->assertSame(422, $e->status);

            throw $e;
        }
    }

    public function test_a_state_with_a_deleted_version_is_never_silently_recomputed_by_another_version(): void
    {
        $registry = app(SpacedRepetitionRegistry::class);

        $this->assertFalse($registry->supports('sm2-tapesh-v0'));
    }
}
