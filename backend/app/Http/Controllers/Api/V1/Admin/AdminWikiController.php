<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiErrorException;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\Wiki\Admin\AdminListWikiArticlesRequest;
use App\Http\Requests\Wiki\Admin\StoreWikiArticleRequest;
use App\Http\Requests\Wiki\Admin\StoreWikiCategoryRequest;
use App\Http\Requests\Wiki\Admin\StoreWikiRelationRequest;
use App\Http\Requests\Wiki\Admin\UpdateWikiArticleRequest;
use App\Http\Requests\Wiki\Admin\UpdateWikiCategoryRequest;
use App\Http\Resources\AdminWikiArticleResource;
use App\Http\Resources\WikiCategoryResource;
use App\Models\Admin;
use App\Models\WikiArticle;
use App\Models\WikiCategory;
use App\Models\WikiRelation;
use App\Services\Wiki\WikiArticleService;
use App\Services\Wiki\WikiCategoryService;
use App\Services\Wiki\WikiQueryService;
use App\Services\Wiki\WikiRelationService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * پنل ویکی — فاز ۱۰.
 *
 *   دسته:   GET/POST   /api/v1/admin/wiki/categories
 *           PATCH/DELETE /api/v1/admin/wiki/categories/{id}
 *   مقاله:  GET/POST   /api/v1/admin/wiki/articles
 *           GET/PATCH  /api/v1/admin/wiki/articles/{id}
 *           POST       /api/v1/admin/wiki/articles/{id}/publish|archive
 *   رابطه:  POST       /api/v1/admin/wiki/relations
 *           DELETE     /api/v1/admin/wiki/relations/{id}
 *
 * **کلیدهای مجوز واقعی پنل**: `articles.*` و `categories.*` از
 * `AdminRbacSeeder` — همان کلیدهایی که ادیتور مقالهٔ پنل فعلی مصرف می‌کند.
 * کلید `wiki.*` **ساخته نشد** چون در RBAC واقعی وجود ندارد و مجوز اختراعی
 * یعنی «deny-by-default» شکسته می‌شود.
 *
 * ⚠️ صادقانه: پنل فعلی ادیتور اختصاصی ویکی ندارد؛ این مسیرها قرارداد سمت سرور
 * برای آن ادیتورند و با همان مجوزهای مقاله/دسته قفل شده‌اند. جزئیات در گزارش
 * فاز ۹–۱۰ آمده است.
 */
class AdminWikiController extends Controller
{
    public function __construct(
        private readonly WikiCategoryService $categories,
        private readonly WikiArticleService $articles,
        private readonly WikiRelationService $relations,
        private readonly WikiQueryService $query,
    ) {}

    // ── دسته‌بندی ────────────────────────────────────────────────────────

    public function categories(): JsonResponse
    {
        return ApiResponse::success(['categories' => WikiCategoryResource::collection($this->categories->adminTree())]);
    }

    public function storeCategory(StoreWikiCategoryRequest $request): JsonResponse
    {
        $category = $this->categories->create($request->validated());

        return ApiResponse::success(['category' => $this->categoryNode($category)], null, 201);
    }

    public function updateCategory(UpdateWikiCategoryRequest $request, string $id): JsonResponse
    {
        $category = $this->categories->update($this->categoryOrFail($id), $request->validated());

        return ApiResponse::success(['category' => $this->categoryNode($category)]);
    }

    public function destroyCategory(string $id): JsonResponse
    {
        $outcome = $this->categories->delete($this->categoryOrFail($id));

        return ApiResponse::success(['outcome' => $outcome]);
    }

    // ── مقاله ───────────────────────────────────────────────────────────

    public function articles(AdminListWikiArticlesRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('wiki.pagination.per_page'));

        $paginator = $this->query->adminList($data, $perPage);

        return ApiResponse::success(
            ['articles' => AdminWikiArticleResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function showArticle(string $id): JsonResponse
    {
        return ApiResponse::success(['article' => new AdminWikiArticleResource($this->articleOrFail($id))]);
    }

    public function storeArticle(StoreWikiArticleRequest $request): JsonResponse
    {
        $article = $this->articles->create($this->admin($request), $request->validated());

        return ApiResponse::success(['article' => new AdminWikiArticleResource($article)], null, 201);
    }

    public function updateArticle(UpdateWikiArticleRequest $request, string $id): JsonResponse
    {
        $article = $this->articles->update($this->admin($request), $this->articleOrFail($id), $request->validated());

        return ApiResponse::success(['article' => new AdminWikiArticleResource($article)]);
    }

    public function publishArticle(string $id): JsonResponse
    {
        $article = $this->articles->publish($this->articleOrFail($id));

        return ApiResponse::success(['article' => new AdminWikiArticleResource($article)]);
    }

    public function archiveArticle(string $id): JsonResponse
    {
        $article = $this->articles->archive($this->articleOrFail($id));

        return ApiResponse::success(['article' => new AdminWikiArticleResource($article)]);
    }

    // ── رابطه ───────────────────────────────────────────────────────────

    public function storeRelation(StoreWikiRelationRequest $request): JsonResponse
    {
        $relation = $this->relations->create($request->validated());

        return ApiResponse::success(['relation' => $this->relationRow($relation)], null, 201);
    }

    public function destroyRelation(string $id): JsonResponse
    {
        $relation = WikiRelation::query()->whereKey($id)->first();

        if (! $relation instanceof WikiRelation) {
            abort(404);
        }

        $this->relations->delete($relation);

        return ApiResponse::success(null, null, 204);
    }

    /**
     * قرارداد **پنل** برای یک لبه — عمداً جدا از `WikiRelationResource`.
     *
     * تفاوت حیاتی: اینجا `id` خودِ رابطه هم برمی‌گردد. پنل برای حذف رابطه به
     * `DELETE /api/v1/admin/wiki/relations/{id}` نیاز دارد و بدون این کلید،
     * پاسخِ ساخت قابل‌استفاده نیست. قرارداد عمومی عوض نشد (§42).
     *
     * @return array<string, mixed>
     */
    private function relationRow(WikiRelation $relation): array
    {
        $to = $relation->toArticle;

        return [
            'id' => $relation->getKey(),
            'article_id' => $relation->to_article_id,
            'slug' => $to?->slug,
            'title' => $to?->title,
            'summary' => $to?->summary,
            'subject' => $to?->subject,
            'content_type' => $to?->content_type,
            'difficulty' => $to?->difficulty,
            'kind' => $relation->kind,
            'kind_label' => $relation->kind,
            'direction' => 'outgoing',
        ];
    }

    /** @return array<string, mixed> */
    private function categoryNode(WikiCategory $category): array
    {
        return [
            'id' => $category->getKey(),
            'slug' => $category->slug,
            'name' => $category->name,
            'description' => $category->description,
            'parent_id' => $category->parent_id,
            'sort_order' => (int) $category->sort_order,
            'status' => $category->status,
            'articles_count' => (int) ($category->articles_count ?? 0),
            'children' => [],
        ];
    }

    private function categoryOrFail(string $id): WikiCategory
    {
        $category = WikiCategory::query()->whereKey($id)->first();

        if (! $category instanceof WikiCategory) {
            abort(404);
        }

        return $category;
    }

    private function articleOrFail(string $id): WikiArticle
    {
        $article = $this->query->adminFind($id);

        if (! $article instanceof WikiArticle) {
            abort(404);
        }

        return $article;
    }

    private function admin(Request $request): Admin
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            throw ApiErrorException::unauthenticated();
        }

        return $admin;
    }
}
