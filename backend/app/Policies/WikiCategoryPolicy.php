<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WikiCategory;

/**
 * دسترسی دستهٔ ویکی.
 *
 * عمومی فقط دستهٔ منتشرشده. دستهٔ پیش‌نویس/آرشیو در API عمومی دیده نمی‌شود،
 * ولی مقاله‌ای که به آن اشاره دارد حذف نمی‌شود (FK `nullOnDelete`).
 */
class WikiCategoryPolicy
{
    public function view(?User $user, WikiCategory $category): bool
    {
        return $category->status === WikiCategory::STATUS_PUBLISHED;
    }
}
