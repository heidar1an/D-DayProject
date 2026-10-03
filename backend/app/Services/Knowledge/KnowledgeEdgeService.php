<?php

namespace App\Services\Knowledge;

use App\Exceptions\ApiErrorException;
use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use Illuminate\Support\Facades\DB;

/**
 * چرخهٔ عمر یال گراف دانش — تنها نویسندهٔ `knowledge_edges`.
 *
 * قفل‌ها (§28): دو سر باید موجود باشند، `from != to` (سرویس + CHECK دیتابیس)،
 * `relation_type` در allowlist سرور، تکرارِ `(from,to,relation_type)` ⇒ ۴۰۹.
 *
 * یال بین دو نود draft هم ساخته‌پذیر است (نویسنده پیش از انتشار سیم‌کشی می‌کند)؛
 * اما تا هر دو سر منتشر نشوند، یال در هیچ پاسخ عمومی دیده نمی‌شود.
 */
class KnowledgeEdgeService
{
    /** @param array<string, mixed> $data */
    public function create(array $data): KnowledgeEdge
    {
        $from = KnowledgeNode::query()->whereKey((string) $data['fromNodeId'])->first();
        $to = KnowledgeNode::query()->whereKey((string) $data['toNodeId'])->first();

        if (! $from instanceof KnowledgeNode || ! $to instanceof KnowledgeNode) {
            throw new ApiErrorException(
                'NODE_NOT_FOUND',
                422,
                'One of the edge endpoints does not exist.',
                $from instanceof KnowledgeNode
                    ? ['toNodeId' => ['NODE_NOT_FOUND']]
                    : ['fromNodeId' => ['NODE_NOT_FOUND']],
            );
        }

        if ($from->getKey() === $to->getKey()) {
            throw new ApiErrorException(
                'SELF_EDGE_FORBIDDEN',
                422,
                'A node cannot be connected to itself.',
                ['toNodeId' => ['SELF_EDGE_FORBIDDEN']],
            );
        }

        $weight = $data['weight'] ?? null;

        if ($weight !== null && ((float) $weight < 0 || (float) $weight > (float) config('knowledge.edges.max_weight'))) {
            throw new ApiErrorException(
                'EDGE_WEIGHT_INVALID',
                422,
                'Edge weight is out of range.',
                ['weight' => ['EDGE_WEIGHT_INVALID']],
            );
        }

        $duplicate = KnowledgeEdge::query()
            ->where('from_node_id', $from->getKey())
            ->where('to_node_id', $to->getKey())
            ->where('relation_type', (string) $data['relation'])
            ->exists();

        if ($duplicate) {
            throw new ApiErrorException(
                'EDGE_ALREADY_EXISTS',
                409,
                'This edge already exists.',
                ['relation' => ['EDGE_ALREADY_EXISTS']],
            );
        }

        $edge = new KnowledgeEdge;

        DB::transaction(function () use ($edge, $from, $to, $data, $weight): void {
            $edge->forceFill([
                'from_node_id' => $from->getKey(),
                'to_node_id' => $to->getKey(),
                'relation_type' => (string) $data['relation'],
                'weight' => $weight === null ? null : (float) $weight,
            ])->save();
        });

        KnowledgeGraphService::bumpCacheVersion();

        return $edge;
    }

    public function delete(KnowledgeEdge $edge): void
    {
        DB::transaction(function () use ($edge): void {
            $edge->delete();
        });

        KnowledgeGraphService::bumpCacheVersion();
    }
}
