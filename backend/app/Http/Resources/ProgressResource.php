<?php

namespace App\Http\Resources;

use App\Models\LearningProgress;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * پیشرفت یک صفحه.
 *
 * اگر رکوردی وجود نداشته باشد، شکل «شروع‌نشده» برمی‌گردد با `id = null` و
 * `version = 0` — همان مقداری که کلاینت باید در اولین PUT بفرستد. این‌طور کلاینت
 * برای «صفحه‌ای که تازه باز شده» یک قرارداد یکسان دارد و لازم نیست null-چک کند.
 */
class ProgressResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $progress = $this->resource instanceof LearningProgress ? $this->resource : null;

        return [
            'id' => $progress?->getKey(),
            'lesson_page_id' => $progress?->lesson_page_id,
            'status' => $progress?->status ?? LearningProgress::STATUS_NOT_STARTED,
            'last_position' => $progress?->last_position,
            'seconds_spent' => (int) ($progress?->seconds_spent ?? 0),
            'version' => (int) ($progress?->version ?? 0),
            'completed_at' => $progress?->completed_at?->toIso8601String(),
            'updated_at' => $progress?->updated_at?->toIso8601String(),
        ];
    }
}
