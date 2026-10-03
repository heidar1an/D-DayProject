<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** گزینه در شکل عمومی — بدون هیچ نشانه‌ای از درست/غلط بودن. */
class QuestionOptionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'position' => (int) $this->resource->position,
            'label' => $this->resource->label,
            'body' => $this->resource->body,
        ];
    }
}
