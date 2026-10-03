<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Learning\CreateStudySessionRequest;
use App\Http\Resources\StudySessionResource;
use App\Models\StudySession;
use App\Services\Learning\StudySessionService;
use Illuminate\Http\JsonResponse;

/**
 * نشست مطالعه — فاز ۵.
 *
 *   POST /api/v1/me/study-sessions  → 201
 *
 * کاربر از سشن تعیین می‌شود. مدت و بازه روی سرور اعتبارسنجی می‌شوند؛ عدد اعلامی
 * کلاینت فقط «پیشنهاد» است.
 */
class StudySessionController extends Controller
{
    public function __construct(private readonly StudySessionService $sessions) {}

    public function store(CreateStudySessionRequest $request): JsonResponse
    {
        $header = (string) config('api.idempotency.header');
        $key = $request->headers->get($header);

        $outcome = $this->sessions->record(
            $request->user(),
            $request->validated(),
            is_string($key) && $key !== '' ? $key : null,
            fn (StudySession $session): array => ['study_session' => (new StudySessionResource($session))->resolve()],
        );

        return ApiResponse::success($outcome->data, $outcome->meta, $outcome->status);
    }
}
