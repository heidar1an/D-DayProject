<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\QuestionBank\ListQuestionsRequest;
use App\Http\Requests\QuestionBank\ShowQuestionRequest;
use App\Http\Resources\QuestionResource;
use App\Services\QuestionBank\QuestionQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * بانک سؤال — مسیر دانشجو (فاز ۶).
 *
 *   GET /api/v1/questions
 *   GET /api/v1/questions/{id}
 *
 * **کلید پاسخ هرگز اینجا نیست.** پاسخِ این دو endpoint از `QuestionResource`
 * ساخته می‌شود که نه `correct_option_id` دارد، نه `explanation`، نه `stats`، نه
 * متادیتای داخلی. کلید فقط پس از `POST /questions/{id}/answers` برمی‌گردد.
 *
 * این مسیرها برای **مهمان هم باز** است (سؤال منتشرشده محتوای عمومی است) ولی
 * پاسخ‌دادن نیازمند ورود است.
 */
class QuestionController extends Controller
{
    public function __construct(private readonly QuestionQueryService $questions) {}

    public function index(ListQuestionsRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('question_bank.pagination.per_page'));
        $sort = (string) ($data['sort'] ?? 'newest');

        $paginator = $this->questions->published($data, $perPage, $sort);

        return ApiResponse::success(
            ['questions' => QuestionResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function show(ShowQuestionRequest $request, string $id): JsonResponse
    {
        return ApiResponse::success([
            'question' => new QuestionResource($this->questions->findPublished($id)),
        ]);
    }
}
