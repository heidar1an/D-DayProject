<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\GreenPath\CalendarRangeRequest;
use App\Http\Requests\GreenPath\UpdateGreenPathStepRequest;
use App\Models\GreenPathStep;
use App\Services\GreenPath\GreenPathService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * مسیر سبز — فاز ۱۳.
 *
 *   GET   /api/v1/me/green-path/profile
 *   GET   /api/v1/me/green-path/roadmap
 *   GET   /api/v1/me/green-path/today
 *   GET   /api/v1/me/green-path/calendar
 *   GET   /api/v1/me/green-path/performance
 *   PATCH /api/v1/me/green-path/steps/{id}
 *
 * هویت همیشه از سشن می‌آید: هیچ مسیری `userId` نمی‌پذیرد. کلاینت فقط
 * وضعیت را render می‌کند؛ تعیین وضعیت و تاریخ با سرور است.
 */
class GreenPathController extends Controller
{
    public function __construct(private readonly GreenPathService $greenPath) {}

    public function profile(Request $request): JsonResponse
    {
        return ApiResponse::success(['profile' => $this->greenPath->profile($request->user())]);
    }

    public function roadmap(Request $request): JsonResponse
    {
        return ApiResponse::success($this->greenPath->roadmap($request->user()));
    }

    public function today(Request $request): JsonResponse
    {
        return ApiResponse::success($this->greenPath->today($request->user()));
    }

    public function calendar(CalendarRangeRequest $request): JsonResponse
    {
        [$from, $to] = $request->range();

        return ApiResponse::success($this->greenPath->calendar($request->user(), $from, $to));
    }

    public function performance(Request $request): JsonResponse
    {
        return ApiResponse::success($this->greenPath->performance($request->user()));
    }

    public function updateStep(UpdateGreenPathStepRequest $request, string $id): JsonResponse
    {
        $outcome = $this->greenPath->updateStep(
            $request->user(),
            $id,
            $request->validated(),
            $this->idempotencyKey($request),
            fn (GreenPathStep $step): array => ['step' => $this->presentStep($step)],
        );

        return ApiResponse::success($outcome->data, $outcome->meta, $outcome->status);
    }

    /** @return array<string, mixed> */
    private function presentStep(GreenPathStep $step): array
    {
        return [
            'id' => $step->getKey(),
            'kind' => $step->kind,
            'target' => match (true) {
                $step->lesson_id !== null => ['type' => 'lesson', 'id' => $step->lesson_id],
                $step->question_id !== null => ['type' => 'question', 'id' => $step->question_id],
                $step->exam_id !== null => ['type' => 'exam', 'id' => $step->exam_id],
                default => null,
            },
            'position' => (int) $step->position,
            'status' => $step->status,
            'due_at' => $step->due_at?->toIso8601String(),
            'completed_at' => $step->completed_at?->toIso8601String(),
            'version' => (int) $step->version,
        ];
    }

    private function idempotencyKey(Request $request): ?string
    {
        $header = (string) config('api.idempotency.header');
        $value = $request->headers->get($header);

        return is_string($value) && $value !== '' ? $value : null;
    }
}
