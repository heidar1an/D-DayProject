<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WikiArticle;
use App\Models\WikiRelation;

/**
 * دسترسی رابطهٔ ویکی — «گراف عمومی» فقط لبه‌های بین **دو مقالهٔ منتشرشده** را
 * نشان می‌دهد (§41).
 *
 * ساخت/حذف رابطه فقط از مسیر ادمین با مجوز واقعی انجام می‌شود؛ این Policy
 * فقط سمت خواندن را قفل می‌کند.
 */
class WikiRelationPolicy
{
    public function view(?User $user, WikiRelation $relation): bool
    {
        $from = $relation->fromArticle;
        $to = $relation->toArticle;

        if (! $from instanceof WikiArticle || ! $to instanceof WikiArticle) {
            return false;
        }

        return $from->isPublished() && $to->isPublished();
    }
}
