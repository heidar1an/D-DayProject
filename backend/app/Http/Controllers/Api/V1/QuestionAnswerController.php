<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\QuestionBank\AnswerQuestionRequest;
use App\Http\Resources\QuestionAttemptResultResource;
use App\Services\QuestionBank\QuestionGradingService;
use Illuminate\Http\JsonResponse;

/**
 * پاسخ به سؤال — فاز ۶.
 *
 *   POST /api/v1/questions/{id}/answers  → 201 (یا ۲۰۰ در بازپخش idempotent)
 *
 * مرز اعتماد: کلاینت فقط «کدام گزینه» را می‌فرستد. درستی، زمان پاسخ، پاداش و
 * بازگشایی همه سمت سرور تعیین می‌شوند. هیچ فیلد نتیجه‌ای از بدنه خوانده نمی‌شود.
 *
 * ورود **اجباری** است: مسیر پاسخ برای مهمان در این فاز وجود ندارد. ستون
 * `guest_id` و CHECK مربوطه در دیتابیس آماده‌اند تا آزمونک مهمان فاز ۷ بدون
 * migration اضافه شود.
 */
class QuestionAnswerController extends Controller
{
    public function __construct(private readonly QuestionGradingService $grading) {}

    public function store(AnswerQuestionRequest $request, string $questionId): JsonResponse
    {
        $data = $request->validated();

        $outcome = $this->grading->answer(
            $request->user(),
            $questionId,
            $data,
            $data['attemptKey'] ?? null,
            fn (array $payload): array => [
                'attempt' => (new QuestionAttemptResultResource($payload))->resolve(),
            ],
        );

        return ApiResponse::success($outcome->data, $outcome->meta, $outcome->status);
    }
}
