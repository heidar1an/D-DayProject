<?php

namespace App\Services\QuestionBank;

use App\Exceptions\ApiErrorException;
use App\Models\Question;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Bank Session — انتخاب سؤال **سمت سرور** با عمر کوتاه.
 *
 * ── تصمیم معماری (مستند، طبق §50 سند فاز) ──
 * سؤال: جدول `bank_sessions` بسازیم یا state گذرا در Redis؟
 *
 * انتخاب: **گذرا در cache store** (Redis در production، array در تست). دلایل:
 *   • نیاز به resume بلندمدت وجود ندارد؛ سشن برای «یک دور تمرین» است، نه تاریخچه.
 *     تاریخچهٔ واقعی از `question_attempts` مشتق می‌شود، نه از این state.
 *   • حجم: هر سشن فقط یک فهرست شناسه + متادیتای کوچک است.
 *   • امنیت: عمر کوتاه یعنی سطح حمله کمتر؛ چیزی برای افشا در دیتابیس نمی‌ماند.
 *   • idempotency: کلید سشن خودش opaque و سرور-ساخته است؛ کلاینت نمی‌تواند
 *     فهرست سؤال را تعیین کند.
 *   • معیار «بدون دلیل جدول تازه نساز» رعایت می‌شود: اگر روزی نیاز به resume
 *     واقعی اثبات شد، همان interface با پیاده‌سازی دیتابیسی جایگزین می‌شود.
 *
 * ویژگی‌ها: user-scoped (شناسهٔ کاربر داخل خود سشن ذخیره و در خواندن چک می‌شود)،
 * opaque (UUIDv4)، TTL اجباری، و **بدون کلید پاسخ** در payload.
 */
class BankSessionService
{
    private const PREFIX = 'bank:session:';

    public function __construct(private readonly QuestionQueryService $questions) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array{session_id: string, mode: string, expires_at: string, questions: list<Question>}
     */
    public function create(User $user, array $filters, int $count, string $mode): array
    {
        $selected = $this->questions->randomSet($filters, $count);

        $sessionId = (string) Str::uuid();
        $ttl = (int) config('question_bank.bank_session.ttl_minutes');

        Cache::put(self::PREFIX.$sessionId, [
            'user_id' => $user->getKey(),
            'mode' => $mode,
            'question_ids' => $selected->pluck('id')->all(),
            'created_at' => now()->toIso8601String(),
        ], now()->addMinutes($ttl));

        return [
            'session_id' => $sessionId,
            'mode' => $mode,
            'expires_at' => now()->addMinutes($ttl)->toIso8601String(),
            'questions' => $selected->all(),
        ];
    }

    /** @return array{session_id: string, mode: string, questions: list<Question>} */
    public function get(User $user, string $sessionId): array
    {
        $state = $this->state($user, $sessionId);

        $ids = is_array($state['question_ids'] ?? null) ? $state['question_ids'] : [];

        // ترتیب سشن حفظ می‌شود: `whereIn` ترتیب را تضمین نمی‌کند.
        $found = Question::query()
            ->published()
            ->whereIn('id', $ids)
            ->with(['subject:id,slug,title', 'topic:id,slug,title,parent_id', 'options'])
            ->get()
            ->keyBy('id');

        $questions = [];
        foreach ($ids as $id) {
            if ($found->has($id)) {
                $questions[] = $found->get($id);
            }
        }

        return [
            'session_id' => $sessionId,
            'mode' => (string) ($state['mode'] ?? 'practice'),
            'questions' => $questions,
        ];
    }

    /** @return array<string, mixed> */
    private function state(User $user, string $sessionId): array
    {
        if (! Str::isUuid($sessionId)) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Bank session not found.');
        }

        $state = Cache::get(self::PREFIX.$sessionId);

        // سشن ناشناخته، منقضی، یا متعلق به کاربر دیگر — همه ۴۰۴ (بدون افشای تفاوت).
        if (! is_array($state) || (string) ($state['user_id'] ?? '') !== (string) $user->getKey()) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Bank session not found.');
        }

        return $state;
    }
}
