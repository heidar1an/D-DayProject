<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * سؤال در شکل **ادمین** — تنها جایی که کلید پاسخ serialize می‌شود.
 *
 * این Resource فقط پشت `api.admin` + `api.can:testbank.read` استفاده می‌شود.
 * هیچ مسیر دانشجویی آن را صدا نمی‌زند.
 */
class AdminQuestionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $question = $this->resource;
        $key = $question->relationLoaded('key') ? $question->key : null;

        return [
            'id' => $question->getKey(),
            'legacy_id' => $question->legacy_id,
            'subject_id' => $question->subject_id,
            'chapter_id' => $question->chapter_id,
            'lesson_id' => $question->lesson_id,
            'topic_id' => $question->topic_id,
            'stem' => $question->stem,
            'figure_key' => $question->figure_key,
            'type' => $question->type,
            'difficulty' => $question->difficulty,
            'source' => $question->source,
            'track' => $question->track,
            'year' => $question->year,
            'exam_month' => $question->exam_month,
            'status' => $question->status,
            'version' => (int) $question->version,
            'author_admin_id' => $question->author_admin_id,
            'published_at' => $question->published_at?->toIso8601String(),
            'options' => QuestionOptionResource::collection($this->whenLoaded('options')),
            'key' => $key === null ? null : [
                'correct_option_id' => $key->correct_option_id,
                'explanation' => $key->explanation,
                'key_version' => (int) $key->key_version,
            ],
        ];
    }
}
