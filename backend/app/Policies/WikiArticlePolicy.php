<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WikiArticle;

/**
 * دسترسی مقالهٔ ویکی — لایهٔ دوم دفاعی.
 *
 * لایهٔ اول: هر کوئری عمومی از `status = published` شروع می‌شود. این Policy
 * تضمین می‌کند اگر روزی کوئری بدون scope نوشته شد، پیش‌نویس/آرشیو لو نرود.
 *
 * ⚠️ کاربر معمولی **هیچ** مسیر نوشتنی ندارد؛ نه update، نه publish. اگر روزی
 * feature واقعی «مقالهٔ کاربری» اضافه شد، همان‌جا policy جدا می‌گیرد.
 */
class WikiArticlePolicy
{
    public function view(?User $user, WikiArticle $article): bool
    {
        return $article->isPublished();
    }

    public function bookmark(User $user, WikiArticle $article): bool
    {
        return $article->isPublished();
    }
}
