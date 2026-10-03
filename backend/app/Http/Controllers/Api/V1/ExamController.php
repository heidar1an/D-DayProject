<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Exam\ListExamsRequest;
use App\Http\Resources\ExamResource;
use App\Services\Exam\ExamQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * فهرست و جزئیات آزمون — فاز ۷.
 *
 *   GET /api/v1/exams
 *   GET /api/v1/exams/{idOrSlug}
 *
 * عمومی است (مهمان هم می‌تواند فهرست را ببیند) ولی **وضعیت کاربر** فقط وقتی
 * محاسبه می‌شود که سشنی وجود داشته باشد. آزمون‌های `draft` و `archived` هرگز
 * برنمی‌گردند — نه در فهرست، نه با شناسهٔ مستقیم (۴۰۴).
 *
 * هیچ فیلد کلیدی در خروجی نیست؛ سؤال‌ها فقط از مسیر Attempt می‌آیند.
 */
class ExamController extends Controller
{
    public function __construct(private readonly ExamQueryService $exams) {}

    public function index(ListExamsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $perPage = (int) ($validated['per_page'] ?? config('exam.pagination.per_page'));
        $page = (int) ($validated['page'] ?? 1);

        ['paginator' => $paginator, 'states' => $states] = $this->exams->paginate(
            $request->user(),
            $validated,
            $perPage,
            $page,
        );

        $items = $paginator->getCollection()
            ->map(fn ($exam): array => (new ExamResource(['exam' => $exam, 'state' => $states[$exam->getKey()]]))->resolve())
            ->all();

        return ApiResponse::success(['exams' => $items], [
            'page' => $paginator->currentPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
            'lastPage' => $paginator->lastPage(),
        ]);
    }

    public function show(Request $request, string $idOrSlug): JsonResponse
    {
        $exam = $this->exams->findVisible($idOrSlug);
        $user = $request->user();

        $states = $this->exams->statesFor($user, collect([$exam]));

        return ApiResponse::success([
            'exam' => (new ExamResource(['exam' => $exam, 'state' => $states[$exam->getKey()]]))->resolve(),
            /* ساعت سرور برای هم‌ترازی تایمر کلاینت — تصمیم زمانی همیشه سرور است. */
            'server_time' => Carbon::now()->toIso8601String(),
        ]);
    }
}
