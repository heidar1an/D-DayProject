<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Articles\ListArticlesRequest;
use App\Http\Resources\ArticleResource;
use App\Http\Resources\ArticleSummaryResource;
use App\Models\Article;
use App\Services\Articles\ArticleQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * مقاله‌ها — عمومی، فاز ۱۶ (§26/§27).
 *
 * فقط `published`؛ پیش‌نویس/آرشیو همان ۴۰۴ ناموجود را می‌گیرند تا slug
 * enumeration وجودشان را افشا نکند (§61).
 */
final class ArticleController extends Controller
{
    public function __construct(
        private readonly ArticleQueryService $query,
    ) {}

    public function index(ListArticlesRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated('perPage') ?? config('articles.pagination.per_page'));

        $paginator = $this->query->published($request->validated(), $perPage);

        return ApiResponse::success(
            ['articles' => ArticleSummaryResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function categories(): JsonResponse
    {
        $categories = collect($this->query->publishedCategories())
            ->map(fn ($category) => [
                'id' => $category->getKey(),
                'slug' => $category->slug,
                'name' => $category->name,
                'sortOrder' => (int) $category->sort_order,
                'articlesCount' => (int) ($category->articles_count ?? 0),
            ])
            ->values()
            ->all();

        return ApiResponse::success(['categories' => $categories]);
    }

    public function show(string $slug): JsonResponse
    {
        $article = $this->query->publishedBySlug($slug);

        if (! $article instanceof Article) {
            abort(404);
        }

        return ApiResponse::success(['article' => new ArticleResource($article)]);
    }
}
