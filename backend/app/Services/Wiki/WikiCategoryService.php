<?php

namespace App\Services\Wiki;

use App\Exceptions\ApiErrorException;
use App\Models\WikiArticle;
use App\Models\WikiCategory;
use App\Support\Content\PersianText;
use Illuminate\Database\Eloquent\Builder;

/**
 * درخت دسته‌بندی ویکی — تنها نویسندهٔ `wiki_categories`.
 *
 * **حفاظت از چرخه** (§38): پیش از هر تغییر `parent_id`، زنجیرهٔ والدها از والد
 * جدید به بالا پیمایش می‌شود؛ اگر به خودِ دسته برسد، تغییر رد می‌شود. این تنها
 * محافظ نیست — `parent_id <> id` هم در دیتابیس هست — ولی چرخهٔ چندسطحی
 * (A→B→C→A) فقط با پیمایش قابل تشخیص است.
 *
 * حذف فیزیکی دستهٔ دارای مقاله ممنوع است؛ مسیر درست آرشیو است.
 */
class WikiCategoryService
{
    /**
     * درخت دسته‌های **منتشرشده** برای API عمومی.
     *
     * @return list<array<string, mixed>>
     */
    public function publicTree(): array
    {
        $categories = WikiCategory::query()
            ->where('status', WikiCategory::STATUS_PUBLISHED)
            ->withCount(['articles as articles_count' => fn (Builder $articles) => $articles
                ->where('status', WikiArticle::STATUS_PUBLISHED)])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->buildTree($categories->all());
    }

    /**
     * فهرست مسطح دسته‌ها برای پنل — همهٔ وضعیت‌ها.
     *
     * @return list<array<string, mixed>>
     */
    public function adminTree(): array
    {
        $categories = WikiCategory::query()
            ->withCount('articles')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->buildTree($categories->all());
    }

    /**
     * ساخت دسته.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): WikiCategory
    {
        $parent = $this->parentOrFail($data['parentId'] ?? null);

        /*
         * سقف عمق باید **همین‌جا** هم اعمال شود، نه فقط در `update()`.
         * تنها راه ساختن درخت عمیق، `create` است؛ اگر فقط جابه‌جایی محافظت
         * داشته باشد، سقف عملاً بی‌اثر است.
         */
        if ($parent !== null) {
            $this->assertDepth($parent);
        }

        $category = new WikiCategory;
        $category->forceFill([
            'parent_id' => $parent?->getKey(),
            'slug' => $this->slug((string) $data['slug'], null),
            'name' => (string) $data['name'],
            'description' => $data['description'] ?? null,
            'sort_order' => (int) ($data['sortOrder'] ?? 0),
            'status' => WikiCategory::STATUS_DRAFT,
        ])->save();

        return $category;
    }

    /**
     * ویرایش دسته — شامل جابه‌جایی والد با حفاظت از چرخه.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(WikiCategory $category, array $data): WikiCategory
    {
        $attributes = [];

        if (array_key_exists('slug', $data)) {
            $attributes['slug'] = $this->slug((string) $data['slug'], $category);
        }

        if (array_key_exists('name', $data)) {
            $attributes['name'] = (string) $data['name'];
        }

        if (array_key_exists('description', $data)) {
            $attributes['description'] = $data['description'];
        }

        if (array_key_exists('sortOrder', $data)) {
            $attributes['sort_order'] = (int) $data['sortOrder'];
        }

        if (array_key_exists('status', $data)) {
            $status = (string) $data['status'];

            if (! in_array($status, (array) config('wiki.categories.statuses'), true)) {
                throw new ApiErrorException('CATEGORY_STATUS_INVALID', 422, 'Unknown category status.', ['status' => ['CATEGORY_STATUS_INVALID']]);
            }

            $attributes['status'] = $status;
        }

        if (array_key_exists('parentId', $data)) {
            $parent = $this->parentOrFail($data['parentId']);

            if ($parent !== null) {
                $this->assertNoCycle($category, $parent);
                $this->assertDepth($parent);
            }

            $attributes['parent_id'] = $parent?->getKey();
        }

        if ($attributes === []) {
            return $category;
        }

        $category->forceFill($attributes)->save();

        return $category;
    }

    /**
     * حذف دسته.
     *
     * اگر مقاله‌ای (در هر وضعیتی) یا فرزندی داشته باشد، **آرشیو** می‌شود و
     * پاسخ می‌گوید چه اتفاقی افتاد. حذف فیزیکی فقط برای دستهٔ خالی.
     *
     * @return 'deleted'|'archived'
     */
    public function delete(WikiCategory $category): string
    {
        $hasArticles = WikiArticle::query()->where('category_id', $category->getKey())->exists();
        $hasChildren = WikiCategory::query()->where('parent_id', $category->getKey())->exists();

        if ($hasArticles || $hasChildren) {
            $category->forceFill(['status' => WikiCategory::STATUS_ARCHIVED])->save();

            return 'archived';
        }

        $category->delete();

        return 'deleted';
    }

    /**
     * پیمایش زنجیرهٔ والدها از `$candidate` به بالا.
     *
     * اگر به `$category` برسیم یعنی چرخه می‌شود (A→B→C→A) ⇒ ۴۲۲.
     */
    public function assertNoCycle(WikiCategory $category, WikiCategory $candidate): void
    {
        if ((string) $candidate->getKey() === (string) $category->getKey()) {
            throw new ApiErrorException(
                'CATEGORY_CYCLE',
                422,
                'A category cannot be its own parent.',
                ['parentId' => ['CATEGORY_CYCLE']],
            );
        }

        $guard = 0;
        $cursor = $candidate;

        while ($cursor !== null) {
            if ((string) $cursor->parent_id === (string) $category->getKey()) {
                throw new ApiErrorException(
                    'CATEGORY_CYCLE',
                    422,
                    'This parent would create a category cycle.',
                    ['parentId' => ['CATEGORY_CYCLE']],
                );
            }

            // محافظت از حلقهٔ از پیش موجود در داده (نباید باشد، ولی نباید hang کند).
            if (++$guard > 64) {
                throw new ApiErrorException('CATEGORY_DEPTH_EXCEEDED', 422, 'Category hierarchy is too deep.');
            }

            $cursor = $cursor->parent_id === null ? null : WikiCategory::query()->find($cursor->parent_id);
        }
    }

    private function assertDepth(WikiCategory $parent): void
    {
        $depth = 1;
        $cursor = $parent;
        $guard = 0;

        while ($cursor !== null) {
            $depth++;

            if ($depth > (int) config('wiki.categories.max_depth', 5)) {
                throw new ApiErrorException('CATEGORY_DEPTH_EXCEEDED', 422, 'Category hierarchy is too deep.');
            }

            if (++$guard > 64) {
                throw new ApiErrorException('CATEGORY_DEPTH_EXCEEDED', 422, 'Category hierarchy is too deep.');
            }

            $cursor = $cursor->parent_id === null ? null : WikiCategory::query()->find($cursor->parent_id);
        }
    }

    private function parentOrFail(mixed $parentId): ?WikiCategory
    {
        if ($parentId === null || $parentId === '') {
            return null;
        }

        $parent = WikiCategory::query()->whereKey((string) $parentId)->first();

        if (! $parent instanceof WikiCategory) {
            throw new ApiErrorException(
                'CATEGORY_PARENT_NOT_FOUND',
                422,
                'The parent category does not exist.',
                ['parentId' => ['CATEGORY_PARENT_NOT_FOUND']],
            );
        }

        return $parent;
    }

    private function slug(string $slug, ?WikiCategory $ignore): string
    {
        $slug = PersianText::slugify($slug);

        if ($slug === '') {
            throw new ApiErrorException('CATEGORY_SLUG_INVALID', 422, 'Category slug is invalid.', ['slug' => ['CATEGORY_SLUG_INVALID']]);
        }

        $exists = WikiCategory::query()
            ->where('slug', $slug)
            ->when($ignore !== null, fn (Builder $query) => $query->whereKeyNot($ignore->getKey()))
            ->exists();

        if ($exists) {
            throw new ApiErrorException('CATEGORY_SLUG_TAKEN', 409, 'This category slug is already used.', ['slug' => ['CATEGORY_SLUG_TAKEN']]);
        }

        return $slug;
    }

    /**
     * ساخت درخت از فهرست مسطح — یک پاس، بدون کوئری اضافه (بدون N+1).
     *
     * @param  list<WikiCategory>  $categories
     * @return list<array<string, mixed>>
     */
    private function buildTree(array $categories): array
    {
        $byId = [];
        $children = [];

        foreach ($categories as $category) {
            $id = (string) $category->getKey();
            $byId[$id] = $category;
            $children[(string) $category->parent_id][] = $id;
        }

        $build = function (string $parentKey) use (&$build, $byId, $children): array {
            $nodes = [];

            foreach ($children[$parentKey] ?? [] as $id) {
                $category = $byId[$id];

                $nodes[] = [
                    'id' => $id,
                    'slug' => $category->slug,
                    'name' => $category->name,
                    'description' => $category->description,
                    'parent_id' => $category->parent_id,
                    'sort_order' => (int) $category->sort_order,
                    'status' => $category->status,
                    'articles_count' => (int) ($category->articles_count ?? 0),
                    'children' => $build($id),
                ];
            }

            return $nodes;
        };

        return $build('');
    }
}
