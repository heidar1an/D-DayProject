<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class AiMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource['id'],
            'role' => 'assistant',
            'text' => $this->resource['text'],
            'status' => 'done',
        ];
    }
}
