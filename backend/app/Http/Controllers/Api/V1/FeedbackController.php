<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Feedback\SubmitFeedbackRequest;
use App\Services\Feedback\FeedbackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * بازخورد کاربر/مهمان — فاز ۱۶ (§46/§48).
 *
 *   POST /api/v1/feedback         ارسال (سشن اختیاری)
 *   GET  /api/v1/me/feedback      بازخوردها + پاسخ‌های من (سشن)
 *   POST /api/v1/me/feedback/read علامت‌گذاری پاسخ‌ها خوانده‌شده
 *
 * هویت فقط از سشن؛ `user` بدنهٔ کلاینت هرگز پذیرفته نمی‌شود. مهمان بدون سشن
 * با `guestRef` شفاف مرورگر خودش ثبت می‌شود.
 */
final class FeedbackController extends Controller
{
    public function __construct(
        private readonly FeedbackService $feedback,
    ) {}

    public function store(SubmitFeedbackRequest $request): JsonResponse
    {
        $user = $request->user();
        $guestRef = $user === null ? $request->validated('guestRef') : null;

        if ($user === null && ($guestRef === null || $guestRef === '')) {
            return ApiResponse::error('VALIDATION_FAILED', 'guestRef is required for guests.', 422, ['guestRef' => ['guestRef is required for guests.']]);
        }

        $result = $this->feedback->submit($user, $guestRef, $request->validated());

        return ApiResponse::success([
            'feedback' => [
                'id' => $result['feedback']->getKey(),
                'source' => $result['feedback']->source,
                'status' => $result['feedback']->status,
                'createdAt' => $result['feedback']->created_at?->toIso8601String(),
            ],
        ], null, 201);
    }

    public function myFeedback(Request $request): JsonResponse
    {
        $rows = collect($this->feedback->listForUser($request->user()))
            ->map(fn ($feedback) => [
                'id' => $feedback->getKey(),
                'source' => $feedback->source,
                'subject' => $feedback->subject,
                'category' => $feedback->category,
                'status' => $feedback->status,
                'body' => $feedback->body,
                'createdAt' => $feedback->created_at?->toIso8601String(),
                'replies' => $feedback->replies->map(fn ($reply) => [
                    'id' => $reply->getKey(),
                    'body' => $reply->body,
                    'adminName' => $reply->admin?->username,
                    'createdAt' => $reply->created_at?->toIso8601String(),
                ])->values()->all(),
            ])
            ->values()
            ->all();

        return ApiResponse::success(['feedback' => $rows]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $updated = $this->feedback->markRepliesRead($request->user());

        return ApiResponse::success(['updated' => $updated]);
    }
}
