<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Learning\UpdateProgressRequest;
use App\Http\Resources\LessonPageResource;
use App\Http\Resources\ProgressResource;
use App\Http\Resources\ProgressSummaryResource;
use App\Models\LearningProgress;
use App\Services\Learning\ProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * پیشرفت یادگیری — فاز ۵.
 *
 *   GET  /api/v1/me/progress
 *   GET  /api/v1/me/progress/pages/{id}
 *   PUT  /api/v1/me/progress/pages/{id}
 *
 * هویت همیشه از سشن می‌آید: هیچ `userId` ای در مسیر یا بدنه خوانده نمی‌شود و
 * مسیر `GET /users/{id}/progress` عمداً وجود ندارد.
 *
 * `Idempotency-Key` (هدر، اختیاری ولی توصیه‌شده): retry شبکه همان درخواست را
 * دوباره اجرا نمی‌کند، پس `seconds_spent` دو بار اضافه نمی‌شود.
 */
class ProgressController extends Controller
{
    public function __construct(private readonly ProgressService $progress) {}

    public function index(Request $request): JsonResponse
    {
        return ApiResponse::success([
            'progress' => new ProgressSummaryResource($this->progress->summary($request->user())),
        ]);
    }

    public function show(Request $request, string $pageId): JsonResponse
    {
        $result = $this->progress->show($request->user(), $pageId);

        if ($result['progress'] instanceof LearningProgress
            && Gate::forUser($request->user())->denies('view', $result['progress'])) {
            return ApiResponse::error('FORBIDDEN', 'Forbidden.', 403);
        }

        return ApiResponse::success([
            'page' => new LessonPageResource($result['page']),
            'progress' => new ProgressResource($result['progress']),
        ]);
    }

    public function update(UpdateProgressRequest $request, string $pageId): JsonResponse
    {
        $outcome = $this->progress->update(
            $request->user(),
            $pageId,
            $request->validated(),
            $this->idempotencyKey($request),
            fn (LearningProgress $progress): array => ['progress' => (new ProgressResource($progress))->resolve()],
        );

        return ApiResponse::success($outcome->data, $outcome->meta, $outcome->status);
    }

    private function idempotencyKey(Request $request): ?string
    {
        $header = (string) config('api.idempotency.header');
        $value = $request->headers->get($header);

        return is_string($value) && $value !== '' ? $value : null;
    }
}
