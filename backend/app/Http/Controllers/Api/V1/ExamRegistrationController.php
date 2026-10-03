<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Services\Exam\ExamRegistrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ثبت‌نام آزمون — فاز ۷.
 *
 *   POST   /api/v1/exams/{idOrSlug}/registrations
 *   DELETE /api/v1/exams/{idOrSlug}/registrations
 *
 * مالکیت **همیشه** از سشن می‌آید. هیچ `userId` ای در مسیر یا بدنه خوانده نمی‌شود
 * و هیچ مسیری مثل `/users/{id}/registrations` وجود ندارد.
 *
 * ثبت‌نام دوباره خطا نیست (idempotent): همان رکورد برمی‌گردد. دلیل: دوبار‌کلیک و
 * retry شبکه نباید کاربر را با ۴۰۹ سرگردان کند، در حالی که `UNIQUE(exam_id,user_id)`
 * در دیتابیس تضمین می‌کند رکورد تکراری ساخته نشود.
 */
class ExamRegistrationController extends Controller
{
    public function __construct(private readonly ExamRegistrationService $registrations) {}

    public function store(Request $request, string $idOrSlug): JsonResponse
    {
        $registration = $this->registrations->register($request->user(), $idOrSlug);

        return ApiResponse::success([
            'exam_id' => $registration->exam_id,
            'registered' => true,
            'registered_at' => $registration->registered_at?->toIso8601String(),
        ], null, 201);
    }

    public function destroy(Request $request, string $idOrSlug): JsonResponse
    {
        $cancelled = $this->registrations->cancel($request->user(), $idOrSlug);

        return ApiResponse::success([
            'registered' => false,
            'cancelled' => $cancelled,
        ]);
    }
}
