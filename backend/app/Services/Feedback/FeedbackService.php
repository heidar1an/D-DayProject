<?php

namespace App\Services\Feedback;

use App\Models\Admin;
use App\Models\Feedback;
use App\Models\FeedbackReply;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * Feedback — فاز ۱۶ (§45-§51).
 *
 * بدنه plain text؛ در Log/کش عمومی/event تحلیلی نمی‌رود (§50). هویت از سشن:
 * کاربرِ واردشده همان سشن است؛ مهمان فقط `guest_ref` شفاف مرورگر خودش را دارد.
 * `admin_id` پاسخ همیشه از سشن ادمین می‌آید و جعل بدنه بی‌اثر است (§49).
 */
final class FeedbackService
{
    /**
     * @param  array<string, mixed>  $data
     * @return array{feedback: Feedback, idempotent: bool}
     */
    public function submit(?User $user, ?string $guestRef, array $data): array
    {
        return DB::transaction(function () use ($user, $guestRef, $data): array {
            $feedback = new Feedback;
            $feedback->forceFill([
                'user_id' => $user?->getKey(),
                'guest_ref' => $user === null ? $guestRef : null,
                'source' => (string) $data['source'],
                'subject' => $data['subject'] ?? null,
                'category' => $data['category'] ?? null,
                'body' => (string) $data['message'],
                'meta' => $this->cleanMeta($data['meta'] ?? null),
                'status' => Feedback::STATUS_OPEN,
            ]);
            $feedback->save();

            return ['feedback' => $feedback, 'idempotent' => false];
        });
    }

    /** پاسخ مدیر — status به answered می‌رود. */
    public function reply(Admin $admin, Feedback $feedback, string $body): FeedbackReply
    {
        return DB::transaction(function () use ($admin, $feedback, $body): FeedbackReply {
            $reply = new FeedbackReply;
            $reply->forceFill([
                'feedback_id' => $feedback->getKey(),
                'admin_id' => $admin->getKey(),
                'body' => $body,
            ]);
            $reply->save();

            $feedback->forceFill(['status' => Feedback::STATUS_ANSWERED])->save();

            return $reply;
        });
    }

    /** فقط بازخوردهای خود کاربر — مالکیت از سشن (§48). */
    public function listForUser(User $user): array
    {
        return Feedback::query()
            ->where('user_id', $user->getKey())
            ->with('replies.admin:id,username')
            ->orderByDesc('created_at')
            ->get()
            ->all();
    }

    public function markRepliesRead(User $user): int
    {
        return Feedback::query()
            ->where('user_id', $user->getKey())
            ->whereHas('replies')
            ->whereNull('user_read_at')
            ->update(['user_read_at' => now()]);
    }

    /** @return LengthAwarePaginator<int, Feedback> */
    public function adminList(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = Feedback::query()->with('replies');

        if (! empty($filters['source'])) {
            $query->where('source', (string) $filters['source']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    /** @return list<string>|null */
    private function cleanMeta(mixed $meta): ?array
    {
        if ($meta === null || ! is_array($meta)) {
            return null;
        }

        // meta ساختار آزاد اما محدود است؛ از آب شدنش به dump دلخواه جلوگیری می‌کنیم.
        $clean = [];

        foreach (array_slice($meta, 0, (int) config('feedback.meta_keys_max'), true) as $key => $value) {
            if (! is_string($key) || strlen($key) > 64) {
                continue;
            }

            $clean[$key] = is_scalar($value) || $value === null ? (is_bool($value) || is_int($value) || is_float($value) ? $value : (string) $value) : null;
        }

        return $clean === [] ? null : $clean;
    }
}
