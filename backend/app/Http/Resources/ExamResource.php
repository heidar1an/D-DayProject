<?php

namespace App\Http\Resources;

use App\Models\Exam;
use App\Services\Exam\ExamRules;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل **عمومی** آزمون — تنها Resource ای که آزمون را به دانشجو می‌رساند.
 *
 * صریحاً وجود ندارد:
 *   • `rules` خام (نگاشت داخلی تصمیم‌گیری) — فقط زیرمجموعهٔ امن؛
 *   • هر چیزی از `exam_questions` (سؤال/کلید) — آن‌ها Resource جدا دارند؛
 *   • `created_by_admin_id` و `legacy_id` — متادیتای داخلی.
 *
 * ورودی این Resource یک wrapper است: `['exam' => Exam, 'state' => array]`.
 * دلیل: وضعیت کاربر (ثبت‌نام/سهمیه/بازهٔ مجاز) از سرویس می‌آید و باید **همان**
 * مقداری باشد که سرور تصمیمش را بر آن گذاشته — نه بازمحاسبه در Resource.
 */
class ExamResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var array{exam: Exam, state: array<string, mixed>} $payload */
        $payload = $this->resource;

        $exam = $payload['exam'];
        $state = $payload['state'];
        $rules = ExamRules::fromArray(is_array($exam->rules) ? $exam->rules : []);

        return [
            'id' => $exam->getKey(),
            'slug' => $exam->slug,
            'kind' => $exam->kind,
            'type' => $exam->type,
            'title' => $exam->title,
            'short_name' => $exam->short_name,
            'description' => $exam->description,
            /* `whenLoaded` اینجا کار نمی‌کند چون `$this->resource` یک wrapper آرایه‌ای
               است، نه مدل. بررسی رابطه صریح انجام می‌شود. */
            'subject' => $exam->relationLoaded('subject') && $exam->subject !== null ? [
                'id' => $exam->subject->getKey(),
                'slug' => $exam->subject->slug,
                'title' => $exam->subject->title,
            ] : null,
            'status' => $state['status'],
            'phase' => $state['phase'],
            'opens_at' => $exam->opens_at?->toIso8601String(),
            'closes_at' => $exam->closes_at?->toIso8601String(),
            'registration_opens_at' => $exam->registration_opens_at?->toIso8601String(),
            'registration_closes_at' => $exam->registration_closes_at?->toIso8601String(),
            'result_release_at' => $exam->result_release_at?->toIso8601String(),
            'duration_minutes' => $exam->duration_minutes,
            'grace_seconds' => (int) $exam->grace_seconds,
            'attempt_limit' => (int) $exam->attempt_limit,
            'negative_marking' => (float) $exam->negative_marking,
            'question_count' => (int) $exam->question_count,
            'rules' => $rules->publicView(),
            'meta' => $exam->meta,
            'user_state' => [
                'registered' => $state['registered'],
                'registered_at' => $state['registered_at'],
                'can_register' => $state['can_register'],
                'can_cancel_registration' => $state['can_cancel_registration'],
                'attempts_used' => $state['attempts_used'],
                'attempt_limit' => $state['attempt_limit'],
                'can_start' => $state['can_start'],
                'active_attempt_id' => $state['active_attempt_id'],
                'last_attempt_id' => $state['last_attempt_id'],
                'result_ready' => $state['result_ready'],
                'has_participated' => $state['has_participated'],
            ],
        ];
    }
}
