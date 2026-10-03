<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wiki\SearchWikiRequest;
use App\Http\Requests\Wiki\SuggestWikiRequest;
use App\Http\Resources\WikiArticleSummaryResource;
use App\Services\Wiki\WikiSearchService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * جست‌وجو و پیشنهاد ویکی — فاز ۱۰.
 *
 *   GET /api/v1/wiki/search?q=…
 *   GET /api/v1/wiki/suggest?q=…
 *
 * هر دو عمومی‌اند و **فقط** روی `published` کار می‌کنند. facetها روی همان
 * مجموعهٔ فیلترشده حساب می‌شوند، نه کل دیتابیس.
 */
class WikiSearchController extends Controller
{
    public function __construct(private readonly WikiSearchService $search) {}

    public function search(SearchWikiRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $perPage = (int) ($filters['perPage'] ?? config('wiki.pagination.per_page'));

        $result = $this->search->search($filters, $perPage);

        return ApiResponse::success(
            [
                'query' => (string) $filters['q'],
                'results' => WikiArticleSummaryResource::collection($result['results']->items()),
                'facets' => $result['facets'],
            ],
            Pagination::meta($result['results']),
        );
    }

    public function suggest(SuggestWikiRequest $request): JsonResponse
    {
        $data = $request->validated();
        $limit = (int) ($data['limit'] ?? config('wiki.search.suggest_limit_default'));

        return ApiResponse::success([
            'query' => (string) $data['q'],
            'suggestions' => $this->search->suggest((string) $data['q'], $limit),
        ]);
    }
}
