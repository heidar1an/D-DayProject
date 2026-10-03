<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل عمومی ناشر بین‌الملل — فاز ۱۷.
 *
 * `status`/`origin`/`legacy_id` عمداً نیستند: مصرف‌کنندهٔ عمومی به چرخهٔ عمر و
 * شناسهٔ مهاجرت کاری ندارد و افشای آن‌ها فقط سطح حمله را باز می‌کند.
 */
class InternationalProviderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'slug' => $this->resource->slug,
            'name' => $this->resource->name,
            'name_en' => $this->resource->name_en,
            'kind' => $this->resource->kind,
            'country' => $this->resource->country,
            'founded' => $this->resource->founded,
            'description' => $this->resource->description,
            'focus' => $this->resource->focus ?? [],
            'logo_media_id' => $this->resource->logo_media_id,
            'logo_url' => $this->logoUrl(),
            'sort_order' => (int) $this->resource->sort_order,
            'marquee_order' => (int) $this->resource->marquee_order,
        ];
    }

    /**
     * آدرس لوگو از Media Core ساخته می‌شود، نه از یک URL خام در دیتابیس.
     * فایل خصوصی از این مسیر قابل خواندن نیست (Policy در `MediaController`).
     */
    private function logoUrl(): ?string
    {
        return $this->resource->logo_media_id === null
            ? null
            : '/api/v1/media/'.$this->resource->logo_media_id.'/stream';
    }
}
