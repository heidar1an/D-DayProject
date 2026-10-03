<?php

namespace App\Services\Flashcards\SpacedRepetition;

use App\Exceptions\ApiErrorException;

/**
 * رجیستری استراتژی‌ها — تنها راه رسیدن به یک الگوریتم.
 *
 * چرا رجیستری و نه `match` داخل سرویس: افزودن V2 نباید هیچ فایلی جز
 * `FlashcardServiceProvider` را عوض کند. سرویس مرور فقط `for($version)` صدا
 * می‌زند و «کدام الگوریتم» یک تصمیم ثبت‌شده است، نه یک شرط پخش‌شده.
 *
 * نسخهٔ ناشناخته **۴۲۲** می‌گیرد (خطای پیکربندی/داده، نه ۵۰۰): اگر روزی رکوردی
 * با نسخهٔ حذف‌شده در دیتابیس بماند، باید صریح شکست بخورد نه بی‌صدا با الگوریتم
 * دیگری محاسبه شود.
 */
final class SpacedRepetitionRegistry
{
    /** @var array<string, SpacedRepetitionStrategy> */
    private array $strategies = [];

    /** @param iterable<SpacedRepetitionStrategy> $strategies */
    public function __construct(iterable $strategies)
    {
        foreach ($strategies as $strategy) {
            $this->strategies[$strategy->version()] = $strategy;
        }
    }

    public function default(): SpacedRepetitionStrategy
    {
        return $this->for((string) config('flashcards.algorithm.default_version'));
    }

    public function for(string $version): SpacedRepetitionStrategy
    {
        if (! isset($this->strategies[$version])) {
            throw new ApiErrorException(
                'ALGORITHM_VERSION_UNKNOWN',
                422,
                'This spaced repetition algorithm version is not available.',
                ['algorithmVersion' => ['ALGORITHM_VERSION_UNKNOWN']],
            );
        }

        return $this->strategies[$version];
    }

    public function supports(string $version): bool
    {
        return isset($this->strategies[$version]);
    }

    /** @return list<string> */
    public function versions(): array
    {
        return array_keys($this->strategies);
    }
}
