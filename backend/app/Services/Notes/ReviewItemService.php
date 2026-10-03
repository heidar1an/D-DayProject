<?php

namespace App\Services\Notes;

use App\Exceptions\ApiErrorException;
use App\Models\ReviewItem;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * آیتم مرور G5 — فاز ۱۶ (§35/§36).
 *
 * فقط مرحلهٔ G5 (۱/۲/۴/۸/۱۶ روز) — با موتور Flashcards کاری ندارد. پیشرفتِ
 * مرور سمت **سرور** محاسبه می‌شود تا کلاینت نتواند مرحله را جعل کند.
 *
 * تکرار امن: UNIQUE(user_id, source_type, source_id) در دیتابیس؛ add دوباره روی
 * آیتم فعال همان آیتم را به‌روز می‌کند (همان رفتار localStorage فعلی) و روی
 * mastered خطا می‌دهد.
 */
final class ReviewItemService
{
    /**
     * @param  array<string, mixed>  $data
     * @return array{item: ReviewItem, idempotent: bool}
     */
    public function add(User $user, array $data, ?Carbon $now = null): array
    {
        $now ??= Carbon::now();
        $sourceId = (string) ($data['sourceId'] ?? (string) Str::uuid());

        try {
            return DB::transaction(function () use ($user, $data, $sourceId, $now): array {
                /** @var ReviewItem|null $existing */
                $existing = ReviewItem::query()
                    ->where('user_id', $user->getKey())
                    ->where('source_type', (string) $data['sourceType'])
                    ->where('source_id', $sourceId)
                    ->lockForUpdate()
                    ->first();

                if ($existing instanceof ReviewItem) {
                    if ($existing->status === ReviewItem::STATUS_MASTERED) {
                        throw new ApiErrorException('REVIEW_ITEM_MASTERED', 409, 'This item is already mastered.');
                    }

                    foreach (['title' => 'title', 'subject' => 'subject', 'description' => 'description', 'activityType' => 'activity_type'] as $input => $column) {
                        if (array_key_exists($input, $data)) {
                            $existing->{$column} = $data[$input];
                        }
                    }

                    $existing->save();

                    return ['item' => $existing, 'idempotent' => true];
                }

                $item = new ReviewItem;
                $item->forceFill([
                    'user_id' => $user->getKey(),
                    'source_type' => (string) $data['sourceType'],
                    'source_id' => $sourceId,
                    'title' => (string) ($data['title'] ?? 'مبحث بدون عنوان'),
                    'subject' => $data['subject'] ?? null,
                    'description' => $data['description'] ?? null,
                    'activity_type' => (string) ($data['activityType'] ?? 'other'),
                    'stage' => 1,
                    'status' => ReviewItem::STATUS_ACTIVE,
                    'learned_at' => $now,
                    'last_reviewed_at' => null,
                    'due_at' => $now->copy()->startOfDay()->addDays($this->intervalFor(1)),
                    'completed_reviews' => 0,
                    'history' => [['type' => 'learned', 'at' => $now->toIso8601String()]],
                ]);
                $item->save();

                return ['item' => $item, 'idempotent' => false];
            });
        } catch (Throwable $e) {
            if ($e instanceof ApiErrorException) {
                throw $e;
            }

            // رقابت insert هم‌زمان روی همان سه‌تایی ⇒ همان رکورد خوانده می‌شود.
            /** @var ReviewItem|null $existing */
            $existing = ReviewItem::query()
                ->where('user_id', $user->getKey())
                ->where('source_type', (string) $data['sourceType'])
                ->where('source_id', $sourceId)
                ->first();

            if ($existing instanceof ReviewItem) {
                return ['item' => $existing, 'idempotent' => true];
            }

            throw $e;
        }
    }

    /** مرور کامل شد: مرحله بعدی یا تسلط. */
    public function completeReview(User $user, string $itemId, ?Carbon $now = null): ReviewItem
    {
        $now ??= Carbon::now();

        return DB::transaction(function () use ($user, $itemId, $now): ReviewItem {
            /** @var ReviewItem|null */
            $item = ReviewItem::query()
                ->where('user_id', $user->getKey())
                ->whereKey($itemId)
                ->lockForUpdate()
                ->first();

            if (! $item instanceof ReviewItem) {
                throw new ApiErrorException('NOT_FOUND', 404, 'Review item not found.');
            }

            if ($item->status === ReviewItem::STATUS_MASTERED) {
                return $item;
            }

            $stage = (int) $item->stage;
            $history = array_merge((array) $item->history, [['type' => 'reviewed', 'stage' => $stage, 'at' => $now->toIso8601String()]]);

            if ($stage >= (int) config('notes.review.max_stage')) {
                $item->forceFill([
                    'status' => ReviewItem::STATUS_MASTERED,
                    'completed_reviews' => (int) config('notes.review.max_stage'),
                    'last_reviewed_at' => $now,
                    'completed_at' => $now,
                    'due_at' => null,
                    'history' => $history,
                ])->save();

                return $item;
            }

            $nextStage = $stage + 1;

            $item->forceFill([
                'stage' => $nextStage,
                'completed_reviews' => $stage,
                'last_reviewed_at' => $now,
                'due_at' => $now->copy()->startOfDay()->addDays($this->intervalFor($nextStage)),
                'history' => $history,
            ])->save();

            return $item;
        });
    }

    /** شروع دوباره از مرحلهٔ ۱. */
    public function restart(User $user, string $itemId, ?Carbon $now = null): ReviewItem
    {
        $now ??= Carbon::now();

        return DB::transaction(function () use ($user, $itemId, $now): ReviewItem {
            /** @var ReviewItem|null */
            $item = ReviewItem::query()
                ->where('user_id', $user->getKey())
                ->whereKey($itemId)
                ->lockForUpdate()
                ->first();

            if (! $item instanceof ReviewItem) {
                throw new ApiErrorException('NOT_FOUND', 404, 'Review item not found.');
            }

            $item->forceFill([
                'stage' => 1,
                'status' => ReviewItem::STATUS_ACTIVE,
                'completed_reviews' => 0,
                'last_reviewed_at' => $now,
                'completed_at' => null,
                'due_at' => $now->copy()->startOfDay()->addDays($this->intervalFor(1)),
                'history' => array_merge((array) $item->history, [['type' => 'restarted', 'at' => $now->toIso8601String()]]),
            ])->save();

            return $item;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(User $user, string $itemId, array $data): ReviewItem
    {
        /** @var ReviewItem|null */
        $item = ReviewItem::query()
            ->where('user_id', $user->getKey())
            ->whereKey($itemId)
            ->first();

        if (! $item instanceof ReviewItem) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Review item not found.');
        }

        foreach (['title' => 'title', 'subject' => 'subject', 'description' => 'description'] as $input => $column) {
            if (array_key_exists($input, $data)) {
                $item->{$column} = $data[$input];
            }
        }

        $item->save();

        return $item;
    }

    public function delete(User $user, string $itemId): void
    {
        $deleted = ReviewItem::query()
            ->where('user_id', $user->getKey())
            ->whereKey($itemId)
            ->delete();

        if ($deleted === 0) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Review item not found.');
        }
    }

    private function intervalFor(int $stage): int
    {
        /** @var array<int, int> $stages */
        $stages = (array) config('notes.review.stages');

        return (int) ($stages[$stage] ?? 1);
    }
}
