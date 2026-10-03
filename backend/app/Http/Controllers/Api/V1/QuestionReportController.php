<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\QuestionBank\CreateQuestionReportRequest;
use App\Http\Resources\QuestionReportResource;
use App\Services\QuestionBank\QuestionReportService;
use Illuminate\Http\JsonResponse;

/**
 * گزارش سؤال — فاز ۶.
 *
 *   POST /api/v1/questions/{id}/reports  → 201
 *
 * فقط **ثبت** گزارش. فهرست گزارش‌ها و تغییر وضعیت (`open` → `reviewing` →
 * `resolved`) کار پنل با مجوز `feedback.manage` است و در این فاز ساخته نشد —
 * وضعیت در دیتابیس از روز اول درست مدل شده تا فاز ۱۶ فقط endpoint اضافه کند.
 */
class QuestionReportController extends Controller
{
    public function __construct(private readonly QuestionReportService $reports) {}

    public function store(CreateQuestionReportRequest $request, string $questionId): JsonResponse
    {
        $report = $this->reports->create($request->user(), $questionId, $request->validated());

        return ApiResponse::success(['report' => new QuestionReportResource($report)], null, 201);
    }
}
