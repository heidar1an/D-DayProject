<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\Articles\Admin\StoreArticleCategoryRequest;
use App\Http\Requests\Articles\Admin\StoreArticleRequest;
use App\Http\Requests\Articles\Admin\UpdateArticleRequest;
use App\Http\Resources\AdminArticleResource;
use App\Models\Admin;
use App\Models\Article;
use App\Models\ArticleCategory;
use App\Services\Articles\ArticleService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * پنل مقاله‌ها — فاز ۱۶ (§70).
 *
 * کلیدهای مجوز واقعی پنل: `articles.*` و `categories.*` (AdminRbacSeeder) —
 * همان کلیدهایی که ادیتور مقالهٔ فعلی مصرف می‌کند؛ کلید اختراعی ساخته نشد.
 */
final class AdminArticleController extends Controller
{
    public function __construct(
        private readonly ArticleService $articles,
    ) {}

    // ── دسته ─────────────────────────────────────────────────────────────

    public function categories(): JsonResponse
    {
        $categories = ArticleCategory::query()
            ->withCount('articles')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (ArticleCategory $category) => [
                'id' => $category->getKey(),
                'slug' => $category->slug,
                'name' => $category->name,
                'sortOrder' => (int) $category->sort_order,
                'status' => $category->status,
                'articlesCount' => (int) ($category->articles_count ?? 0),
            ])
            ->values()
            ->all();

        return ApiResponse::success(['categories' => $categories]);
    }

    public function storeCategory(StoreArticleCategoryRequest $request): JsonResponse
    {
        $category = new ArticleCategory;
        $category->forceFill([
            'slug' => (string) $request->validated('slug'),
            'name' => (string) $request->validated('name'),
            'sort_order' => (int) ($request->validated('sortOrder') ?? 0),
            // دسته taxonomy است، نه محتوا — همین‌جا public می‌شود؛ publish جدا
            // برای آن route ندارد و draftِ بی‌پایان بی‌معناست (§25).
            'status' => ArticleCategory::STATUS_PUBLISHED,
        ]);
        $category->save();

        return ApiResponse::success(['category' => ['id' => $category->getKey(), 'slug' => $category->slug, 'name' => $category->name, 'sortOrder' => (int) $category->sort_order, 'status' => $category->status]], null, 201);
    }

    public function updateCategory(StoreArticleCategoryRequest $request, string $id): JsonResponse
    {
        $category = $this->categoryOrFail($id);
        $data = $request->validated();

        foreach (['slug' => 'slug', 'name' => 'name', 'sortOrder' => 'sort_order'] as $input => $column) {
            if (array_key_exists($input, $data)) {
                $category->{$column} = $input === 'sortOrder' ? (int) $data[$input] : $data[$input];
            }
        }

        $category->save();

        return ApiResponse::success(['category' => ['id' => $category->getKey(), 'slug' => $category->slug, 'name' => $category->name, 'sortOrder' => (int) $category->sort_order, 'status' => $category->status]]);
    }

    public function destroyCategory(string $id): JsonResponse
    {
        $category = $this->categoryOrFail($id);

        // مقاله‌های متصل؟ FK nullOnDelete است — دسته خالی می‌شود، مقاله‌ها می‌مانند.
        $category->delete();

        return ApiResponse::success(null, null, 204);
    }

    // ── مقاله ────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('perPage', (string) config('articles.pagination.per_page'));
        $perPage = min(max($perPage, 1), (int) config('articles.pagination.max_per_page'));

        $query = Article::query()->with('category:id,slug,name')->orderByDesc('updated_at');

        $status = (string) $request->query('status', '');

        if (in_array($status, (array) config('articles.statuses'), true)) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate($perPage);

        return ApiResponse::success(
            ['articles' => AdminArticleResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function show(string $id): JsonResponse
    {
        return ApiResponse::success(['article' => new AdminArticleResource($this->articleOrFail($id))]);
    }

    public function store(StoreArticleRequest $request): JsonResponse
    {
        $article = $this->articles->create($this->admin($request), $request->validated());

        return ApiResponse::success(['article' => new AdminArticleResource($article)], null, 201);
    }

    public function update(UpdateArticleRequest $request, string $id): JsonResponse
    {
        $article = $this->articles->update($this->admin($request), $this->articleOrFail($id), $request->validated());

        return ApiResponse::success(['article' => new AdminArticleResource($article)]);
    }

    public function publish(string $id): JsonResponse
    {
        return ApiResponse::success(['article' => new AdminArticleResource($this->articles->publish($this->articleOrFail($id)))]);
    }

    public function archive(string $id): JsonResponse
    {
        return ApiResponse::success(['article' => new AdminArticleResource($this->articles->archive($this->articleOrFail($id)))]);
    }

    private function articleOrFail(string $id): Article
    {
        /** @var Article|null */
        $article = Article::query()->with('category:id,slug,name')->whereKey($id)->first();

        if (! $article instanceof Article) {
            abort(404);
        }

        return $article;
    }

    private function categoryOrFail(string $id): ArticleCategory
    {
        /** @var ArticleCategory|null */
        $category = ArticleCategory::query()->whereKey($id)->first();

        if (! $category instanceof ArticleCategory) {
            abort(404);
        }

        return $category;
    }

    private function admin(Request $request): Admin
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            abort(401);
        }

        return $admin;
    }
}
