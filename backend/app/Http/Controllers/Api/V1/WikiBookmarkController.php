<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wiki\ListWikiBookmarksRequest;
use App\Http\Resources\WikiBookmarkResource;
use App\Models\WikiArticle;
use App\Services\Wiki\WikiBookmarkService;
use App\Services\Wiki\WikiQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * نشان‌گذاری ویکی کاربر جاری — فاز ۱۰.
 *
 *   GET    /api/v1/me/wiki-bookmarks              فهرست نشان‌های خودم
 *   PUT    /api/v1/me/wiki-bookmarks/{articleId}  افزودن (idempotent)
 *   DELETE /api/v1/me/wiki-bookmarks/{articleId}  حذف (idempotent)
 *
 * **IDOR (§40):** هویت فقط از سشن می‌آید. هیچ مسیر `GET /users/{id}/…` وجود
 * ندارد و `{articleId}` فقط **موضوع** است، نه منبع مجوز. افزودن نشان برای
 * مقالهٔ پیش‌نویس ۴۰۴ می‌گیرد.
 */
class WikiBookmarkController extends Controller
{
    public function __construct(
        private readonly WikiBookmarkService $bookmarks,
        private readonly WikiQueryService $query,
    ) {}

    public function index(ListWikiBookmarksRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('wiki.pagination.per_page'));

        $paginator = $this->bookmarks->list($request->user(), $perPage);

        return ApiResponse::success(
            ['bookmarks' => WikiBookmarkResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function store(Request $request, string $articleId): JsonResponse
    {
        $article = $this->publishedOrFail($articleId);

        $bookmark = $this->bookmarks->add($request->user(), $article);

        return ApiResponse::success(
            ['bookmark' => new WikiBookmarkResource($bookmark->load('article'))],
            null,
            201,
        );
    }

    public function destroy(Request $request, string $articleId): JsonResponse
    {
        // حذف idempotent است: مقالهٔ منتشرشده لازم است، ولی نبودن نشان خطا نیست.
        $article = $this->publishedOrFail($articleId);

        $this->bookmarks->remove($request->user(), $article);

        return ApiResponse::success(null, null, 204);
    }

    private function publishedOrFail(string $articleId): WikiArticle
    {
        $article = $this->query->publishedById($articleId);

        if (! $article instanceof WikiArticle) {
            abort(404);
        }

        return $article;
    }
}
