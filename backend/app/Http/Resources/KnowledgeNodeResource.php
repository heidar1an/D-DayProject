<?php

namespace App\Http\Resources;

use App\Models\KnowledgeNode;
use App\Models\WikiArticle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * نود عمومی گراف — فاز ۱۲.
 *
 * قرارداد §15 پرامپت: `{id, label, kind}`. هیچ فیلد داخلی دیتابیس (status،
 * timestamp، شناسهٔ مقالهٔ خام) افشا نمی‌شود. ارجاع مقالهٔ ویکی فقط وقتی
 * می‌آید که نود واقعاً به مقالهٔ **منتشرشده‌ای** متصل باشد و eager آن لود
 * شده باشد (§16).
 *
 * @property KnowledgeNode $resource
 */
class KnowledgeNodeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /*
         * فقط اگر eager لود شده باشد — وگرنه هرگز lazy نکن (N+1). سرویس‌های
         * گراف همیشه `wikiArticle` منتشرشده را با خودشان می‌آورند.
         */
        $article = $this->resource->relationLoaded('wikiArticle')
            ? $this->resource->getRelation('wikiArticle')
            : null;

        return [
            'id' => $this->resource->getKey(),
            'label' => $this->resource->label,
            'kind' => $this->resource->kind,
            'article' => $article instanceof WikiArticle ? [
                'slug' => $article->slug,
                'title' => $article->title,
            ] : null,
        ];
    }
}
