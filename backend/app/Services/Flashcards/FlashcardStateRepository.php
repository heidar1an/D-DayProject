<?php

namespace App\Services\Flashcards;

use App\Models\Flashcard;
use App\Models\FlashcardState;
use App\Models\User;
use App\Services\Flashcards\SpacedRepetition\SpacedRepetitionRegistry;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * ساخت/قفل ردیف وضعیت — تنها نقطهٔ ساخت `flashcard_states`.
 *
 * چرا جدا: هم سرویس مرور و هم اکشن‌های suspend/bury/bookmark به «وضعیت این
 * کاربر برای این کارت» نیاز دارند. اگر هرکدام خودش می‌ساخت، دو مسیر ساخت با
 * دو مجموعه پیش‌فرض به‌وجود می‌آمد و `algorithm_version` یکی از قلم می‌افتاد.
 *
 * تلهٔ PostgreSQL: `INSERT` شکست‌خورده کل تراکنش جاری را abort می‌کند و هر
 * کوئری بعدی `25P02` می‌دهد. پس رقابت روی `UNIQUE(user_id, card_id)` داخل یک
 * `DB::transaction` (savepoint) بسته می‌شود؛ همان الگوی `IdempotencyService`.
 */
class FlashcardStateRepository
{
    public function __construct(private readonly SpacedRepetitionRegistry $strategies) {}

    /** وضعیت موجود را برمی‌گرداند یا وضعیت «نو» می‌سازد. */
    public function getOrCreate(User $user, Flashcard $card): FlashcardState
    {
        $existing = $this->find($user, $card);

        if ($existing instanceof FlashcardState) {
            return $existing;
        }

        $state = $this->fresh($user, $card);

        try {
            DB::transaction(fn () => $state->save());
        } catch (UniqueConstraintViolationException) {
            // درخواست هم‌زمان دیگری ساخت؛ همان رکورد معتبر است.
            $state = $this->find($user, $card) ?? $state;
        }

        return $state;
    }

    /**
     * وضعیت را با قفل ردیف برمی‌گرداند — برای مسیر مرور.
     *
     * قفل روی `flashcard_states` گرفته می‌شود چون همان ردیف منبع تغییر است.
     * دو مرور هم‌زمان یک کارت، پشت این قفل سریال می‌شوند و دومی وضعیت **تازه**
     * را می‌خواند (نه عکس کهنه).
     */
    public function lockForReview(User $user, Flashcard $card): FlashcardState
    {
        $state = $this->getOrCreate($user, $card);

        $locked = FlashcardState::query()
            ->whereKey($state->getKey())
            ->lockForUpdate()
            ->first();

        return $locked ?? $state;
    }

    public function find(User $user, Flashcard $card): ?FlashcardState
    {
        return FlashcardState::query()
            ->where('user_id', $user->getKey())
            ->where('card_id', $card->getKey())
            ->first();
    }

    /**
     * وضعیت تازه و **ذخیره‌نشده** — همهٔ مقادیر پیش‌فرض از الگوریتم می‌آیند، نه
     * از کلاینت.
     *
     * کاربرد دوم آن پیش‌نمایش فاصله‌ها برای کارتی است که کاربر هنوز مرورش نکرده؛
     * در آن حالت نباید رکوردی ساخته شود.
     */
    public function fresh(User $user, Flashcard $card): FlashcardState
    {
        $strategy = $this->strategies->default();

        $state = new FlashcardState;
        $state->forceFill([
            'user_id' => $user->getKey(),
            'card_id' => $card->getKey(),
            'algorithm_version' => $strategy->version(),
            'state' => FlashcardState::STATE_NEW,
            'due_at' => null,
            'interval_days' => 0,
            'interval_minutes' => 0,
            'ease' => (float) config('flashcards.algorithm.v1.starting_ease', 2.5),
            'review_count' => 0,
            'lapse_count' => 0,
            'correct_count' => 0,
            'incorrect_count' => 0,
            'learning_step' => 0,
            'difficulty' => 0.3,
            'stability' => 0,
            'mastery_score' => 0,
            'suspended' => false,
            'buried_until' => null,
            'bookmarked' => false,
            'last_reviewed_at' => null,
            'version' => 1,
        ]);

        return $state;
    }
}
