<?php

namespace App\Services\Knowledge;

use App\Exceptions\ApiErrorException;
use App\Models\KnowledgeNode;
use App\Models\WikiArticle;
use App\Support\Content\RichTextSanitizer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * چرخهٔ عمر نود گراف دانش — تنها نویسندهٔ `knowledge_nodes`.
 *
 * مرز اعتماد (§27): `status` هرگز از بدنه خوانده نمی‌شود — فقط از مسیرهای
 * publish/archive. `wiki_article_id` از بدنه می‌آید ولی پیش از نوشتن، وجود و
 * وضعیت مقاله سمت سرور سنجیده می‌شود (مقالهٔ آرشیوشده لینک نمی‌گیرد).
 *
 * حذف فیزیکی: فقط وقتی نود **هیچ یالی ندارد** — در غیر این صورت ۴۰۹ تا هیچ یال
 * تاریخی یتیم نشود (§39/§40؛ مسیر درست آرشیو است).
 */
class KnowledgeNodeService
{
    public function __construct(private readonly RichTextSanitizer $sanitizer) {}

    /** @param array<string, mixed> $data */
    public function create(array $data): KnowledgeNode
    {
        $node = new KnowledgeNode;

        DB::transaction(function () use ($node, $data): void {
            $node->forceFill([
                'wiki_article_id' => $this->articleId($data['wikiArticleId'] ?? null, null),
                'kind' => (string) $data['kind'],
                'label' => $this->label($data['label']),
                'status' => KnowledgeNode::STATUS_DRAFT,
            ])->save();
        });

        KnowledgeGraphService::bumpCacheVersion();

        return $node;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(KnowledgeNode $node, array $data): KnowledgeNode
    {
        $attributes = [];

        if (array_key_exists('label', $data)) {
            $attributes['label'] = $this->label($data['label']);
        }

        if (array_key_exists('kind', $data)) {
            $attributes['kind'] = (string) $data['kind'];
        }

        if (array_key_exists('wikiArticleId', $data)) {
            $attributes['wiki_article_id'] = $this->articleId($data['wikiArticleId'], $node);
        }

        DB::transaction(function () use ($node, $attributes): void {
            $node->forceFill($attributes)->save();
        });

        KnowledgeGraphService::bumpCacheVersion();

        return $node;
    }

    public function publish(KnowledgeNode $node): KnowledgeNode
    {
        $node->forceFill(['status' => KnowledgeNode::STATUS_PUBLISHED])->save();

        KnowledgeGraphService::bumpCacheVersion();

        return $node;
    }

    public function archive(KnowledgeNode $node): KnowledgeNode
    {
        $node->forceFill(['status' => KnowledgeNode::STATUS_ARCHIVED])->save();

        KnowledgeGraphService::bumpCacheVersion();

        return $node;
    }

    public function delete(KnowledgeNode $node): void
    {
        $hasEdges = $node->outgoingEdges()->exists() || $node->incomingEdges()->exists();

        if ($hasEdges) {
            throw new ApiErrorException(
                'NODE_HAS_EDGES',
                409,
                'The node still has edges. Archive it instead of deleting.',
                ['id' => ['NODE_HAS_EDGES']],
            );
        }

        DB::transaction(function () use ($node): void {
            $node->delete();
        });

        KnowledgeGraphService::bumpCacheVersion();
    }

    /**
     * اعتبارسنجی پیوند مقاله — وجود، وضعیت، یکتایی (با استثنای نودِ در حال ویرایش).
     */
    private function articleId(mixed $wikiArticleId, ?KnowledgeNode $ignore): ?string
    {
        if ($wikiArticleId === null || $wikiArticleId === '') {
            return null;
        }

        $article = WikiArticle::query()->whereKey((string) $wikiArticleId)->first();

        if (! $article instanceof WikiArticle) {
            throw new ApiErrorException(
                'WIKI_ARTICLE_NOT_FOUND',
                422,
                'The selected wiki article does not exist.',
                ['wikiArticleId' => ['WIKI_ARTICLE_NOT_FOUND']],
            );
        }

        if ($article->status === WikiArticle::STATUS_ARCHIVED) {
            throw new ApiErrorException(
                'WIKI_ARTICLE_ARCHIVED',
                422,
                'An archived wiki article cannot be linked to a node.',
                ['wikiArticleId' => ['WIKI_ARTICLE_ARCHIVED']],
            );
        }

        $linked = KnowledgeNode::query()
            ->where('wiki_article_id', $article->getKey())
            ->when($ignore !== null, fn (Builder $query) => $query->whereKeyNot($ignore->getKey()))
            ->exists();

        if ($linked) {
            throw new ApiErrorException(
                'ARTICLE_ALREADY_LINKED',
                409,
                'This wiki article already has a knowledge node.',
                ['wikiArticleId' => ['ARTICLE_ALREADY_LINKED']],
            );
        }

        return (string) $article->getKey();
    }

    private function label(mixed $label): string
    {
        $clean = $this->sanitizer->toPlainText((string) ($label ?? '')) ?? '';

        if ($clean === '') {
            throw new ApiErrorException('NODE_LABEL_REQUIRED', 422, 'Node label is required.', ['label' => ['NODE_LABEL_REQUIRED']]);
        }

        if (mb_strlen($clean) > (int) config('knowledge.nodes.label_max')) {
            throw new ApiErrorException('NODE_LABEL_TOO_LONG', 422, 'Node label is too long.', ['label' => ['NODE_LABEL_TOO_LONG']]);
        }

        return $clean;
    }
}
