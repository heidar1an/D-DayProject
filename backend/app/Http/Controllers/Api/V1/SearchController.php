<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Search\SearchRequest;
use App\Http\Resources\SearchResultResource;
use App\Services\Search\SearchService;
use Illuminate\Http\JsonResponse;

/**
 * جست‌وجوی عمومی — فاز ۱۹ (§37).
 *
 * منبع پاسخ **پروجکشن** است، نه حقیقت دامنه؛ و هر نتیجه یک بار دیگر با سیاست
 * دسترسی دامنه فیلتر می‌شود (§34/§39).
 */
final class SearchController extends Controller
{
    public function __construct(
        private readonly SearchService $search,
    ) {}

    public function index(SearchRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated('perPage') ?? config('search.pagination.per_page'));

        $result = $this->search->search(
            query: (string) $request->validated('q'),
            type: $request->validated('type'),
            sort: (string) ($request->validated('sort') ?? 'relevance'),
            page: (int) ($request->validated('page') ?? 1),
            perPage: $perPage,
        );

        return ApiResponse::success(
            ['results' => SearchResultResource::collection($result['items'])],
            [
                'page' => $result['page'],
                'perPage' => $result['perPage'],
                'total' => $result['total'],
                'lastPage' => $result['lastPage'],
                /* شفافیت: نتیجه‌ها از سقف نامزدهای FTS فراتر نمی‌روند. */
                'candidateCapped' => $result['candidateCapped'],
            ],
        );
    }
}
