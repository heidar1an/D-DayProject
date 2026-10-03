<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * نتیجهٔ جست‌وجو — فاز ۱۹.
 *
 * شکل پاسخ عمداً «نتیجه» است نه «موجودیت دامنه»: هر آیتم نوع، برچسب و متن
 * بریده را می‌دهد و کلاینت برای جزئیات به endpoint همان دامنه می‌رود. هیچ
 * فیلد داخلی (status، کلید پاسخ، مسیر ذخیره) بیرون نمی‌آید.
 *
 * @property array<string, mixed> $resource
 */
final class SearchResultResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'entityType' => (string) $this->resource['entityType'],
            'entityId' => (string) $this->resource['entityId'],
            'label' => (string) $this->resource['label'],
            'title' => (string) $this->resource['title'],
            'snippet' => (string) $this->resource['snippet'],
        ];
    }
}
