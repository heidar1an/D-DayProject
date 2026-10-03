<?php

namespace App\Services\Flashcards\SpacedRepetition;

use Carbon\CarbonImmutable;

/**
 * خروجی محاسبهٔ الگوریتم — **تمام مقادیر سرور-ساخته**.
 *
 * این کلاس عمداً readonly و بدون setter است: هیچ‌جای سیستم نمی‌تواند «بازهٔ
 * دلخواه» یا «ease دلخواه» را از بیرون تزریق کند؛ فقط استراتژی می‌سازد.
 */
final readonly class ReviewComputation
{
    public function __construct(
        public string $state,
        public CarbonImmutable $dueAt,
        public int $intervalMinutes,
        public float $intervalDays,
        public float $ease,
        public int $learningStep,
        public float $difficulty,
        public float $stability,
        public int $masteryScore,
        public int $reviewCount,
        public int $lapseCount,
        public int $correctCount,
        public int $incorrectCount,
    ) {}
}
