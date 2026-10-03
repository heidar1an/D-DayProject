<?php

namespace Tests\Concerns;

use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use App\Models\WikiArticle;

/**
 * ساخت دادهٔ گراف دانش برای تست — فاز ۱۲.
 *
 * مثل `BuildsWiki`: نود/یال draft باید مستقیم روی مدل ساخته شود تا مرز
 * «انتشار» واقعاً سنجیده شود، نه دور زده.
 */
trait BuildsKnowledge
{
    /** @param array<string, mixed> $attributes */
    protected function makeNode(array $attributes = [], ?WikiArticle $article = null): KnowledgeNode
    {
        static $sequence = 0;

        $sequence++;

        $node = new KnowledgeNode;
        $node->forceFill([
            'wiki_article_id' => $attributes['wiki_article_id'] ?? $article?->getKey(),
            'kind' => (string) ($attributes['kind'] ?? 'concept'),
            'label' => (string) ($attributes['label'] ?? 'مفهوم '.$sequence),
            'status' => (string) ($attributes['status'] ?? KnowledgeNode::STATUS_DRAFT),
        ])->save();

        return $node;
    }

    /** @param array<string, mixed> $attributes */
    protected function makePublishedNode(array $attributes = [], ?WikiArticle $article = null): KnowledgeNode
    {
        return $this->makeNode([...$attributes, 'status' => KnowledgeNode::STATUS_PUBLISHED], $article);
    }

    /** @param array<string, mixed> $attributes */
    protected function makeEdge(KnowledgeNode $from, KnowledgeNode $to, array $attributes = []): KnowledgeEdge
    {
        $edge = new KnowledgeEdge;
        $edge->forceFill([
            'from_node_id' => $from->getKey(),
            'to_node_id' => $to->getKey(),
            'relation_type' => (string) ($attributes['relation_type'] ?? 'related_to'),
            'weight' => $attributes['weight'] ?? null,
        ])->save();

        return $edge;
    }

    /**
     * مقالهٔ ویکی بدون گذر از سرویس — برای سناریوهای پیوند نود↔مقاله.
     *
     * @param  array<string, mixed>  $attributes
     */
    protected function makeWikiArticleForNode(array $attributes = []): WikiArticle
    {
        static $sequence = 0;

        $sequence++;

        $article = new WikiArticle;
        $article->forceFill([
            'slug' => (string) ($attributes['slug'] ?? 'node-article-'.$sequence),
            'title' => (string) ($attributes['title'] ?? 'مقالهٔ نود '.$sequence),
            'body' => '<p>متن</p>',
            'status' => (string) ($attributes['status'] ?? WikiArticle::STATUS_PUBLISHED),
            'version' => 1,
            'published_at' => ($attributes['status'] ?? WikiArticle::STATUS_PUBLISHED) === WikiArticle::STATUS_PUBLISHED ? now() : null,
        ])->save();

        return $article;
    }
}
