<?php

namespace App\Events\QuestionBank;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * پاسخ ثبت شد. payload فقط شناسه + یک boolean — نه متن سؤال، نه کلید پاسخ.
 */
final class QuestionAnswered
{
    use Dispatchable;

    public function __construct(
        public readonly string $userId,
        public readonly string $questionId,
        public readonly string $attemptId,
        public readonly bool $isCorrect,
    ) {}
}
