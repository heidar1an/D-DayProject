<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل عمومی یک نشست مطالعه.
 *
 * هیچ `user_id` برنمی‌گردد: مالکیت برای خودِ کلاینت بدیهی است و افشای شناسه
 * کاربر در payload هیچ مصرف‌کننده‌ای ندارد.
 */
class StudySessionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $session = $this->resource;

        return [
            'id' => $session->getKey(),
            'lesson_page_id' => $session->lesson_page_id,
            'source' => $session->source,
            'started_at' => $session->started_at?->toIso8601String(),
            'ended_at' => $session->ended_at?->toIso8601String(),
            'duration_sec' => $session->duration_sec,
        ];
    }
}
