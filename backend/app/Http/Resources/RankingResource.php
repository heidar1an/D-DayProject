<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * رتبه‌بندی — تجمیع + رتبهٔ خودِ کاربر، **بدون هیچ PII**.
 *
 * هیچ فهرست شرکت‌کننده‌ای برنمی‌گردد: نه نام، نه شناسه، نه ایمیل. اگر UI روزی
 * leaderboard بخواهد، مسیر جدا با pseudonymize و صفحه‌بندی لازم است — نه افزودن
 * فیلد به همین Resource.
 */
class RankingResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed> $ranking */
        $ranking = $this->resource;

        return [
            'exam_id' => $ranking['exam_id'],
            'participants_count' => $ranking['participants_count'],
            'top_percent' => $ranking['top_percent'],
            'median_percent' => $ranking['median_percent'],
            'average_percent' => $ranking['average_percent'],
            'me' => $ranking['me'],
        ];
    }
}
