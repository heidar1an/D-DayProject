<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\QuestionBank\StartBankSessionRequest;
use App\Http\Resources\BankSessionResource;
use App\Services\QuestionBank\BankSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Bank Session — فاز ۶.
 *
 *   POST /api/v1/bank/sessions        → 201 (انتخاب سؤال سمت سرور)
 *   GET  /api/v1/bank/sessions/{id}   → 200 (همان مجموعه، بدون کلید)
 *
 * ورود اجباری است: سشن به کاربر گره می‌خورد و خواندنش با کاربر دیگری ۴۰۴ می‌دهد.
 *
 * **Exam Engine اینجا نیست:** این endpoint فقط «مجموعهٔ سؤال برای تمرین» می‌سازد.
 * هیچ تایمر، هیچ ثبت‌نام آزمون، هیچ نمره و هیچ کارنامه‌ای در این فاز ساخته نمی‌شود.
 */
class BankSessionController extends Controller
{
    public function __construct(private readonly BankSessionService $sessions) {}

    public function store(StartBankSessionRequest $request): JsonResponse
    {
        $data = $request->validated();

        $session = $this->sessions->create(
            $request->user(),
            is_array($data['filters'] ?? null) ? $data['filters'] : [],
            (int) ($data['count'] ?? config('question_bank.bank_session.default_count')),
            (string) ($data['mode'] ?? 'practice'),
        );

        return ApiResponse::success(['bank_session' => new BankSessionResource($session)], null, 201);
    }

    public function show(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->sessions->get($request->user(), $sessionId);

        return ApiResponse::success(['bank_session' => new BankSessionResource($session)]);
    }
}
