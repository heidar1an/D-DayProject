<?php

namespace App\Policies;

use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use App\Models\User;

/**
 * دسترسی یال گراف دانش — لایهٔ دوم دفاعی.
 *
 * یال فقط وقتی عمومی است که **هر دو سر** منتشر باشند؛ وگرنه یال، وجود یک نود
 * خصوصی را لو می‌دهد («یادیت عمومی» ممنوع — §40 پرامپت فاز).
 */
class KnowledgeEdgePolicy
{
    public function view(?User $user, KnowledgeEdge $edge): bool
    {
        $from = $edge->fromNode;
        $to = $edge->toNode;

        return $from instanceof KnowledgeNode
            && $to instanceof KnowledgeNode
            && $from->isPublished()
            && $to->isPublished();
    }
}
