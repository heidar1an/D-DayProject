<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل **عمومی** سؤال — تنها Resource ای که به دانشجو می‌رسد.
 *
 * صریحاً وجود ندارد:
 *   • `correct_answer` / `correct_option_id` / `explanation` / `key` — کلید پاسخ؛
 *   • `status` / `version` / `legacy_id` / `author_admin_id` — متادیتای داخلی و
 *     مدیریتی؛
 *   • `stats` / `option_percents` — توزیع پاسخ، که خودش کلید را لو می‌دهد.
 *
 * اگر روزی کسی این فیلدها را «برای راحتی UI» اضافه کند، تست امنیتی
 * `AnswerKeyIsolationTest` می‌شکند.
 */
class QuestionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $question = $this->resource;

        return [
            'id' => $question->getKey(),
            'stem' => $question->stem,
            'figure_key' => $question->figure_key,
            'type' => $question->type,
            'difficulty' => $question->difficulty,
            'source' => $question->source,
            'track' => $question->track,
            'year' => $question->year,
            'exam_month' => $question->exam_month,
            'subject' => $this->whenLoaded('subject', fn () => [
                'id' => $question->subject->getKey(),
                'slug' => $question->subject->slug,
                'title' => $question->subject->title,
            ]),
            'topic' => $this->whenLoaded('topic', fn () => $question->topic === null ? null : [
                'id' => $question->topic->getKey(),
                'slug' => $question->topic->slug,
                'title' => $question->topic->title,
            ]),
            'options' => QuestionOptionResource::collection($this->whenLoaded('options')),
        ];
    }
}
