<?php

namespace App\Services\Wiki;

use App\Events\Wiki\WikiBookmarkAdded;
use App\Events\Wiki\WikiBookmarkRemoved;
use App\Exceptions\ApiErrorException;
use App\Models\User;
use App\Models\WikiArticle;
use App\Models\WikiBookmark;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * نشان‌گذاری مقاله — مالکیت فقط از سشن.
 *
 * **IDOR** (§40): هیچ متدی `userId` نمی‌گیرد و هیچ مسیری
 * `GET /users/{id}/wiki-bookmarks` وجود ندارد. فهرست همیشه با
 * `where('user_id', $user->getKey())` محدود می‌شود.
 *
 * تکرار امن: `UNIQUE(user_id, article_id)` تنها تضمین race-safe است. دو درخواست
 * هم‌زمان یک رکورد می‌سازند، نه دو — و `INSERT` شکست‌خورده در savepoint بسته
 * می‌شود تا روی PostgreSQL تراکنش abort نشود (`25P02`).
 */
class WikiBookmarkService
{
    /** @return LengthAwarePaginator<int, WikiBookmark> */
    public function list(User $user, int $perPage): LengthAwarePaginator
    {
        return WikiBookmark::query()
            ->where('user_id', $user->getKey())
            /*
             * فقط مقالهٔ منتشرشده. اگر مقاله‌ای آرشیو/پیش‌نویس شود، نشان کاربر
             * باقی می‌ماند ولی از فهرست عمومی او ناپدید می‌شود — همان قاعده‌ای
             * که جلوی نشت پیش‌نویس را می‌گیرد.
             */
            ->whereHas('article', fn ($query) => $query->where('status', WikiArticle::STATUS_PUBLISHED))
            ->with(['article' => fn ($query) => $query->where('status', WikiArticle::STATUS_PUBLISHED)])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function add(User $user, WikiArticle $article): WikiBookmark
    {
        if (! $article->isPublished()) {
            // نشان‌گذاری پیش‌نویس ⇒ ۴۰۴ (وجودش لو نمی‌رود).
            throw new ApiErrorException('NOT_FOUND', 404, 'Article not found.');
        }

        $bookmark = new WikiBookmark;
        $bookmark->forceFill([
            'user_id' => $user->getKey(),
            'article_id' => $article->getKey(),
        ]);

        try {
            DB::transaction(fn () => $bookmark->save());
        } catch (UniqueConstraintViolationException) {
            // از قبل نشان‌شده — همان رکورد برگردانده می‌شود (idempotent).
            $existing = WikiBookmark::query()
                ->where('user_id', $user->getKey())
                ->where('article_id', $article->getKey())
                ->first();

            if ($existing instanceof WikiBookmark) {
                return $existing;
            }

            throw new ApiErrorException('BOOKMARK_CONFLICT', 409, 'Could not bookmark this article.');
        }

        WikiBookmarkAdded::dispatch((string) $user->getKey(), (string) $article->getKey());

        return $bookmark;
    }

    /** حذف idempotent است: نبودن نشان خطا نیست. */
    public function remove(User $user, WikiArticle $article): void
    {
        $deleted = WikiBookmark::query()
            ->where('user_id', $user->getKey())
            ->where('article_id', $article->getKey())
            ->delete();

        if ($deleted > 0) {
            WikiBookmarkRemoved::dispatch((string) $user->getKey(), (string) $article->getKey());
        }
    }

    public function isBookmarked(User $user, WikiArticle $article): bool
    {
        return WikiBookmark::query()
            ->where('user_id', $user->getKey())
            ->where('article_id', $article->getKey())
            ->exists();
    }
}
