<?php

namespace App\Services\Articles;

use App\Exceptions\ApiErrorException;
use App\Models\Article;
use App\Models\ArticleBookmark;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * نشان‌گذاری مقاله — فاز ۱۶ (§28).
 *
 * آینهٔ WikiBookmarkService: مالکیت فقط از سشن، هیچ متدی userId نمی‌گیرد.
 * UNIQUE(user_id, article_id) تضمین race-safe است و INSERT شکست‌خورده در
 * savepoint بسته می‌شود تا روی PostgreSQL تراکنش abort نشود (`25P02`).
 */
final class ArticleBookmarkService
{
    /** @return LengthAwarePaginator<int, ArticleBookmark> */
    public function list(User $user, int $perPage): LengthAwarePaginator
    {
        return ArticleBookmark::query()
            ->where('user_id', $user->getKey())
            ->whereHas('article', fn ($query) => $query->where('status', Article::STATUS_PUBLISHED))
            ->with(['article' => fn ($query) => $query->where('status', Article::STATUS_PUBLISHED)])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * PUT idempotent: `created` تشکیل تازه را مشخص می‌کند تا کنترلر ۲۰۱/۲۰۰
     * درست بدهد — تکرار نشان، منبع تازه‌ای نمی‌سازد.
     *
     * @return array{bookmark: ArticleBookmark, created: bool}
     */
    public function add(User $user, Article $article): array
    {
        if (! $article->isPublished()) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Article not found.');
        }

        $existing = ArticleBookmark::query()
            ->where('user_id', $user->getKey())
            ->where('article_id', $article->getKey())
            ->first();

        if ($existing instanceof ArticleBookmark) {
            return ['bookmark' => $existing, 'created' => false];
        }

        $bookmark = new ArticleBookmark;
        $bookmark->forceFill([
            'user_id' => $user->getKey(),
            'article_id' => $article->getKey(),
        ]);

        try {
            DB::transaction(fn () => $bookmark->save());
        } catch (UniqueConstraintViolationException) {
            /** @var ArticleBookmark|null $raced */
            $raced = ArticleBookmark::query()
                ->where('user_id', $user->getKey())
                ->where('article_id', $article->getKey())
                ->first();

            if ($raced instanceof ArticleBookmark) {
                return ['bookmark' => $raced, 'created' => false];
            }

            throw new ApiErrorException('BOOKMARK_CONFLICT', 409, 'Could not bookmark this article.');
        }

        return ['bookmark' => $bookmark, 'created' => true];
    }

    /** حذف idempotent: نشان ناموجود خطا نیست. */
    public function remove(User $user, Article $article): void
    {
        ArticleBookmark::query()
            ->where('user_id', $user->getKey())
            ->where('article_id', $article->getKey())
            ->delete();
    }
}
