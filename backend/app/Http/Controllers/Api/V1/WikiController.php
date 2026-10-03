<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\Wiki\WikiArticleOpened;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wiki\ListWikiArticlesRequest;
use App\Http\Resources\WikiArticleResource;
use App\Http\Resources\WikiArticleSummaryResource;
use App\Http\Resources\WikiCategoryResource;
use App\Http\Resources\WikiRelationResource;
use App\Models\WikiArticle;
use App\Services\Wiki\WikiArticleService;
use App\Services\Wiki\WikiCategoryService;
use App\Services\Wiki\WikiQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ویکی — محتوای عمومی (فاز ۱۰).
 *
 *   GET /api/v1/wiki/categories            درخت دسته‌های منتشرشده
 *   GET /api/v1/wiki/articles              فهرست مقاله‌های منتشرشده
 *   GET /api/v1/wiki/articles/{slug}       مقاله + رابطه‌ها
 *
 * همهٔ این مسیرها **عمومی** هستند (بدون سشن هم کار می‌کنند) و فقط `published`
 * را برمی‌گردانند. `draft`/`archived` ⇒ ۴۰۴.
 */
class WikiController extends Controller
{
    public function __construct(
        private readonly WikiQueryService $query,
        private readonly WikiCategoryService $categories,
        private readonly WikiArticleService $articles,
    ) {}

    public function categories(): JsonResponse
    {
        $tree = $this->categories->publicTree();

        return ApiResponse::success(['categories' => WikiCategoryResource::collection($tree)]);
    }

    public function articles(ListWikiArticlesRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $perPage = (int) ($filters['perPage'] ?? config('wiki.pagination.per_page'));

        $paginator = $this->query->published($filters, $perPage);

        return ApiResponse::success(
            ['articles' => WikiArticleSummaryResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $article = $this->query->publishedBySlug($slug);

        if (! $article instanceof WikiArticle) {
            // پیش‌نویس/آرشیو و slug ناموجود یک پاسخ می‌گیرند: وجودشان لو نمی‌رود.
            abort(404);
        }

        $relations = $this->query->relations($article);

        /*
         * شمارش بازدید و رخداد «باز شد» — رخداد فقط برای تحلیل است و
         * **completion آموزشی محسوب نمی‌شود** (§51).
         */
        $this->articles->recordView($article);
        WikiArticleOpened::dispatch(
            (string) $article->getKey(),
            $request->user()?->getKey(),
            (string) $article->slug,
        );

        return ApiResponse::success([
            'article' => new WikiArticleResource($article),
            'related' => WikiRelationResource::collection($relations['related']),
            'backlinks' => WikiRelationResource::collection($relations['backlinks']),
        ]);
    }
}
