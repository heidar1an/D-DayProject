<?php

namespace App\Policies;

use App\Models\KnowledgeNode;
use App\Models\User;

/**
 * دسترسی نود گراف دانش — لایهٔ دوم دفاعی.
 *
 * لایهٔ اول: هر کوئری عمومی از `status = published` شروع می‌شود. این Policy
 * تضمین می‌کند اگر روزی کوئری بدون scope نوشته شد، نود پیش‌نویس/آرشیو لو نرود.
 *
 * ⚠️ کاربر معمولی **هیچ** مسیر نوشتنی روی گراف ندارد؛ نوشتن فقط از پنل با
 * مجوزهای واقعی RBAC است.
 */
class KnowledgeNodePolicy
{
    public function view(?User $user, KnowledgeNode $node): bool
    {
        return $node->isPublished();
    }
}
