<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeNode;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * کوئری‌های سطح پنل گراف دانش — فاز ۱۲.
 *
 * برخلاف سطح عمومی، پنل **همهٔ** وضعیت‌ها را می‌بیند (دستور کارِ نویسنده
 * پیش‌نویس‌هاست). sort و filter فقط allowlist؛ کلاینت هرگز فیلد SQL خام
 * نمی‌فرستد.
 */
class KnowledgeQueryService
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function adminList(array $filters, int $perPage): LengthAwarePaginator
    {
        return KnowledgeNode::query()
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['kind'] ?? null, fn (Builder $query, string $kind) => $query->where('kind', $kind))
            ->when($filters['q'] ?? null, function (Builder $query, string $q): void {
                $query->where('label', 'like', '%'.addcslashes($q, '%_\\').'%');
            })
            ->withCount(['outgoingEdges', 'incomingEdges'])
            ->when(
                ($filters['sort'] ?? 'created_at') === 'label',
                fn (Builder $query) => $query->orderBy('label')->orderBy('id'),
                fn (Builder $query) => $query->orderBy('created_at')->orderBy('id'),
            )
            ->paginate(min($perPage, (int) config('wiki.pagination.max_per_page')))
            ->through(function (KnowledgeNode $node): KnowledgeNode {
                $node->edges_count = (int) $node->outgoing_edges_count + (int) $node->incoming_edges_count;

                return $node;
            });
    }

    public function adminFind(string $id): ?KnowledgeNode
    {
        return KnowledgeNode::query()->whereKey($id)->first();
    }
}
