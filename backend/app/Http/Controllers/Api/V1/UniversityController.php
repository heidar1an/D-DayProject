<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\University\IndexUniversitiesRequest;
use App\Http\Resources\UniversityResource;
use App\Models\University;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * فهرست دانشگاه‌های فعال — endpoint عمومی (بدون ورود).
 *
 * امنیت کوئری:
 *   • فقط `search`/`page`/`per_page`/`sort` از allowlist پذیرفته می‌شوند
 *     (`IndexUniversitiesRequest` بقیه را با `prohibited` رد می‌کند).
 *   • جست‌وجو با binding پارامتری انجام می‌شود و نویسه‌های wildcard در ورودی
 *     escape می‌شوند ⇒ نه SQL injection، نه `%`ِ کاربر به‌عنوان الگوی کامل.
 *   • فقط `active=true` برمی‌گردد.
 */
class UniversityController extends Controller
{
    public function index(IndexUniversitiesRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $perPage = (int) ($validated['per_page'] ?? config('identity.universities.per_page'));
        $page = (int) ($validated['page'] ?? 1);
        $search = $this->escapeLike((string) ($validated['search'] ?? ''));
        $sort = (string) ($validated['sort'] ?? 'name');

        $cacheKey = 'api:v1:universities:'.hash('sha256', json_encode([$search, $perPage, $page, $sort]));

        $payload = Cache::remember(
            $cacheKey,
            (int) config('identity.universities.cache_seconds'),
            function () use ($search, $perPage, $page, $sort): array {
                $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
                $column = ltrim($sort, '-') === 'slug' ? 'slug' : 'name';

                $paginator = University::query()
                    ->active()
                    ->when($search !== '', fn ($query) => $query->where('name', 'like', '%'.$search.'%'))
                    ->orderBy($column, $direction)
                    ->paginate(perPage: $perPage, page: $page);

                return [
                    'data' => UniversityResource::collection($paginator->items())->resolve(),
                    'meta' => [
                        'page' => $paginator->currentPage(),
                        'perPage' => $paginator->perPage(),
                        'total' => $paginator->total(),
                        'lastPage' => $paginator->lastPage(),
                    ],
                ];
            },
        );

        return ApiResponse::success($payload['data'], $payload['meta']);
    }

    /** نویسه‌های ویژهٔ LIKE باید درون **مقدار** escape شوند، نه با حذف. */
    private function escapeLike(string $value): string
    {
        $value = trim($value);

        return $value === '' ? '' : str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
