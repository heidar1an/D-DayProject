<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * یال گراف دانش — فاز ۱۲.
 *
 * یال **جهت‌دار** است: `A —relation_type→ B` لزوماً معکوسِ `B → A` نیست (§12).
 * یکتایی روی `(from, to, relation_type)` است — دو رابطهٔ متفاوت بین همان دو نود
 * (مثلاً `produces` و `regulates`) مجازند.
 *
 * `$fillable` خالی است؛ نوشتن فقط با `forceFill` از سرویس.
 */
class KnowledgeEdge extends Model
{
    use HasUuids;

    protected $table = 'knowledge_edges';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'weight' => 'float',
        ];
    }

    /** @return BelongsTo<KnowledgeNode, $this> */
    public function fromNode(): BelongsTo
    {
        return $this->belongsTo(KnowledgeNode::class, 'from_node_id');
    }

    /** @return BelongsTo<KnowledgeNode, $this> */
    public function toNode(): BelongsTo
    {
        return $this->belongsTo(KnowledgeNode::class, 'to_node_id');
    }
}
