<?php

namespace App\Services\Wiki;

use App\Exceptions\ApiErrorException;
use App\Models\WikiArticle;
use App\Models\WikiRelation;

/**
 * رابطه‌های بین مقاله‌ها — پایهٔ گراف فاز ۱۱، **نه** گراف واقعی.
 *
 * سه قید:
 *   • `kind` فقط از allowlist (`config('wiki.relations.kinds')`).
 *   • self relation ممنوع (دو مقالهٔ متفاوت).
 *   • `UNIQUE(from,to,kind)` — تکرار رابطه ۴۰۹ می‌گیرد.
 *
 * ⚠️ ساخت رابطه هیچ‌وقت مقالهٔ مقصد را «منتشر» نمی‌کند و وضعیت آن را عوض
 * نمی‌کند. رابطه به مقالهٔ پیش‌نویس مجاز است ولی در خروجی عمومی فقط وقتی
 * دیده می‌شود که **هر دو سر** منتشرشده باشند (§41).
 */
class WikiRelationService
{
    /** @param array<string, mixed> $data */
    public function create(array $data): WikiRelation
    {
        $from = $this->articleOrFail((string) $data['fromArticleId'], 'fromArticleId');
        $to = $this->articleOrFail((string) $data['toArticleId'], 'toArticleId');
        $kind = (string) $data['kind'];

        if (! in_array($kind, (array) config('wiki.relations.kinds'), true)) {
            throw new ApiErrorException(
                'RELATION_KIND_INVALID',
                422,
                'Unknown relation kind.',
                ['kind' => ['RELATION_KIND_INVALID']],
            );
        }

        if ((string) $from->getKey() === (string) $to->getKey()) {
            throw new ApiErrorException(
                'RELATION_SELF_NOT_ALLOWED',
                422,
                'An article cannot relate to itself.',
                ['toArticleId' => ['RELATION_SELF_NOT_ALLOWED']],
            );
        }

        $existing = WikiRelation::query()
            ->where('from_article_id', $from->getKey())
            ->where('to_article_id', $to->getKey())
            ->where('kind', $kind)
            ->exists();

        if ($existing) {
            throw new ApiErrorException('RELATION_EXISTS', 409, 'This relation already exists.');
        }

        $relation = new WikiRelation;
        $relation->forceFill([
            'from_article_id' => $from->getKey(),
            'to_article_id' => $to->getKey(),
            'kind' => $kind,
        ])->save();

        return $relation;
    }

    public function delete(WikiRelation $relation): void
    {
        $relation->delete();
    }

    private function articleOrFail(string $id, string $field): WikiArticle
    {
        $article = WikiArticle::query()->whereKey($id)->first();

        if (! $article instanceof WikiArticle) {
            throw new ApiErrorException(
                'ARTICLE_NOT_FOUND',
                422,
                'The related article does not exist.',
                [$field => ['ARTICLE_NOT_FOUND']],
            );
        }

        return $article;
    }
}
