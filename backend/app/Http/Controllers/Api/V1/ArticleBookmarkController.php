<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Resources\ArticleBookmarkResource;
use App\Models\Article;
use App\Services\Articles\ArticleBookmarkService;
use App\Services\Articles\ArticleQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * نشان‌گذاری مقاله کاربر جاری — فاز ۱۶ (§28).
 *
 *   GET    /api/v1/me/article-bookmarks/{articleId}?no — فهرست
 *   PUT    /api/v1/me/article-bookmarks/{articleId}    افزودن (idempotent)
 *   DELETE /api/v1/me/article-bookmarks/{articleId}    حذف (idempotent)
 *
 * هویت فقط از سشن؛ `{articleId}` موضوع است، نه منبع مجوز (IDOR §61).
 */
final class ArticleBookmarkController extends Controller
{
    public function __construct(
        private readonly ArticleBookmarkService $bookmarks,
        private readonly ArticleQueryService $query,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('perPage', '24');
        $perPage = min(max($perPage, 1), 48);

        $paginator = $this->bookmarks->list($request->user(), $perPage);

        return ApiResponse::success(
            ['bookmarks' => ArticleBookmarkResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function store(Request $request, string $articleId): JsonResponse
    {
        $article = $this->publishedOrFail($articleId);

        $result = $this->bookmarks->add($request->user(), $article);

        // PUT idempotent: ساخت تازه ۲۰۱، تکرارِ نشان موجود ۲۰۰ — منبع تازه
        // ساخته نمی‌شود.
        return ApiResponse::success(
            ['bookmark' => new ArticleBookmarkResource($result['bookmark']->load('article'))],
            null,
            $result['created'] ? 201 : 200,
        );
    }

    public function destroy(Request $request, string $articleId): JsonResponse
    {
        $article = $this->publishedOrFail($articleId);

        $this->bookmarks->remove($request->user(), $article);

        return ApiResponse::success(null, null, 204);
    }

    private function publishedOrFail(string $articleId): Article
    {
        $article = $this->query->publishedBySlug((string) $articleId);

        // شناسه هم پذیرفته می‌شود (UUID) — اما فقط مقالهٔ منتشرشده.
        if (! $article instanceof Article && preg_match('/^[0-9a-f-]{36}$/i', $articleId)) {
            /** @var Article|null */
            $article = Article::query()
                ->where('status', Article::STATUS_PUBLISHED)
                ->whereKey($articleId)
                ->first();
        }

        if (! $article instanceof Article) {
            abort(404);
        }

        return $article;
    }
}
