<?php

namespace App\Services\Flashcards\SpacedRepetition;

use App\Models\FlashcardState;
use Carbon\CarbonImmutable;

/**
 * قرارداد الگوریتم Spaced Repetition.
 *
 * چرا interface و نه یک سرویس مشخص: فاز ۹ صریحاً می‌گوید الگوریتم باید
 * **قابل تعویض** باشد و هیچ نسخه‌ای مجاز نیست Reviewهای نسخهٔ دیگر را
 * بازمحاسبه کند. هر نسخه یک `version()` دارد و رجیستری بر اساس همان انتخاب
 * می‌کند. Controller هرگز الگوریتم را اجرا نمی‌کند (§13).
 */
interface SpacedRepetitionStrategy
{
    /** شناسهٔ نسخه — در `flashcard_states.algorithm_version` و هر Review نوشته می‌شود. */
    public function version(): string;

    /**
     * وضعیت فعلی + rating ⇒ وضعیت بعدی.
     *
     * ورودی `$state` ممکن است یک وضعیت ذخیره‌نشده (کارت نو) باشد؛ پیاده‌سازی
     * نباید به وجود رکورد در دیتابیس تکیه کند.
     */
    public function schedule(FlashcardState $state, string $rating, CarbonImmutable $now): ReviewComputation;
}
