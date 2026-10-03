<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Resources\ExamAttemptResource;
use App\Http\Resources\ExamResultResource;
use App\Http\Resources\ExamReviewResource;
use App\Services\Exam\ExamResultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * کارنامه و مرور — فاز ۷.
 *
 *   GET /api/v1/exam-attempts/{id}/result
 *   GET /api/v1/exam-attempts/{id}/review
 *
 * `result` یک ماشین وضعیت است: `ready | processing | not_participated`.
 * پیش از انتشار، پاسخ **فقط** `{state: 'processing', release_at}` است — هیچ عددی
 * (نه نمره، نه درصد، نه تعداد درست) افشا نمی‌شود. این دروازه در سرویس اعمال
 * می‌شود، نه در Resource، تا هیچ مسیری نتواند دورش بزند.
 *
 * `review` تنها جایی است که کلید پاسخ از سرور بیرون می‌رود و پیش‌شرط‌هایش
 * (`allow_review` + released + مالکیت + پایان Attempt) در سرویس چک می‌شوند.
 */
class ExamResultController extends Controller
{
    public function __construct(private readonly ExamResultService $results) {}

    public function show(Request $request, string $attemptId): JsonResponse
    {
        $payload = $this->results->result($request->user(), $attemptId);

        return match ($payload['state']) {
            'ready' => ApiResponse::success([
                'state' => 'ready',
                'attempt' => (new ExamAttemptResource($payload['attempt']))->resolve(),
                'result' => (new ExamResultResource($payload['result']))->resolve(),
            ]),
            'processing' => ApiResponse::success([
                'state' => 'processing',
                'release_at' => $payload['release_at'],
            ]),
            default => ApiResponse::success([
                'state' => 'not_participated',
            ]),
        };
    }

    public function review(Request $request, string $attemptId): JsonResponse
    {
        $payload = $this->results->review($request->user(), $attemptId);

        $items = $payload['questions']
            ->map(fn ($question): array => (new ExamReviewResource([
                'question' => $question,
                'answer' => $payload['answers']->get($question->getKey()),
            ]))->resolve())
            ->all();

        return ApiResponse::success([
            'attempt' => (new ExamAttemptResource($payload['attempt']))->resolve(),
            'questions' => $items,
        ]);
    }
}
