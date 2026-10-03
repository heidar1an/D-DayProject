<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiErrorException;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\QuestionBank\Admin\AdminListQuestionsRequest;
use App\Http\Requests\QuestionBank\Admin\StoreQuestionRequest;
use App\Http\Requests\QuestionBank\Admin\UpdateQuestionRequest;
use App\Http\Resources\AdminQuestionResource;
use App\Models\Admin;
use App\Models\Question;
use App\Models\Subject;
use App\Services\QuestionBank\QuestionQueryService;
use App\Services\QuestionBank\QuestionService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD سؤال در پنل — فاز ۶.
 *
 *   GET    /api/v1/admin/questions                 `testbank.read`
 *   GET    /api/v1/admin/questions/{id}            `testbank.read`
 *   POST   /api/v1/admin/questions                 `testbank.create`
 *   PATCH  /api/v1/admin/questions/{id}            `testbank.update`
 *   POST   /api/v1/admin/questions/{id}/publish    `testbank.publish`
 *   POST   /api/v1/admin/questions/{id}/archive    `testbank.publish`
 *
 * **DELETE وجود ندارد، عمداً.** سؤالِ استفاده‌شده در `question_attempts` (و در
 * فاز ۷ در `exam_questions`) نباید فیزیکی حذف شود؛ FKهای RESTRICT هم جلوی آن را
 * می‌گیرند. مسیر درست `archive` است.
 *
 * مجوزها با کلیدهای **واقعی** پنل legacy چک می‌شوند (`testbank.*`)، نه کلیدهای
 * اختراعی. `author_admin_id` از سشن ادمین می‌آید، نه از بدنه.
 */
class AdminQuestionController extends Controller
{
    public function __construct(
        private readonly QuestionService $questions,
        private readonly QuestionQueryService $query,
    ) {}

    public function index(AdminListQuestionsRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('question_bank.pagination.per_page'));

        $paginator = $this->query->adminList($data, $perPage);

        return ApiResponse::success(
            ['questions' => AdminQuestionResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function show(string $id): JsonResponse
    {
        return ApiResponse::success([
            'question' => new AdminQuestionResource($this->query->findForAdmin($id)),
        ]);
    }

    public function store(StoreQuestionRequest $request): JsonResponse
    {
        $data = $request->validated();

        $subject = Subject::query()->findOrFail($data['subject_id']);

        $question = $this->questions->create(
            $subject,
            $this->contentFields($data),
            $data['options'],
            is_array($data['key'] ?? null) ? $data['key'] : [],
            $this->adminId($request),
        );

        return ApiResponse::success(['question' => new AdminQuestionResource($question)], null, 201);
    }

    public function update(UpdateQuestionRequest $request, string $id): JsonResponse
    {
        $data = $request->validated();

        $question = Question::query()->findOrFail($id);

        /*
         * تغییر درس سؤال ممنوع است و **قبل** از نوشتن رد می‌شود.
         *
         * چرا قبل و نه بعد: اگر بعد از `update()` چک می‌شد، محتوای سؤال ذخیره
         * می‌شد و نسخه بالا می‌رفت، ولی کلاینت ۴۰۹ می‌گرفت — یعنی یک نوشتن
         * انجام‌شده که کلاینت فکر می‌کند انجام نشده. سؤال متعلق به درس دیگری
         * باید سؤال تازه باشد، نه جابه‌جایی.
         */
        if (array_key_exists('subject_id', $data)
            && (string) $data['subject_id'] !== (string) $question->subject_id) {
            throw new ApiErrorException(
                'SUBJECT_IMMUTABLE',
                409,
                'Changing a question subject is not supported; create a new question instead.',
            );
        }

        $question = $this->questions->update(
            $question,
            $this->contentFields($data),
            is_array($data['options'] ?? null) ? $data['options'] : null,
            is_array($data['key'] ?? null) ? $data['key'] : null,
            (int) $data['version'],
        );

        return ApiResponse::success(['question' => new AdminQuestionResource($question)]);
    }

    public function publish(string $id): JsonResponse
    {
        $question = $this->questions->publish(Question::query()->findOrFail($id));

        return ApiResponse::success([
            'question' => new AdminQuestionResource($question->load(['options', 'key'])),
        ]);
    }

    public function archive(string $id): JsonResponse
    {
        $question = $this->questions->archive(Question::query()->findOrFail($id));

        return ApiResponse::success([
            'question' => new AdminQuestionResource($question->load(['options', 'key'])),
        ]);
    }

    /**
     * فقط فیلدهای محتوایی — `status`، `version`، `author_admin_id`، `legacy_id` و
     * `published_at` هرگز از اینجا نمی‌گذرند.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function contentFields(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'chapter_id', 'lesson_id', 'topic_id', 'stem', 'figure_key',
            'type', 'difficulty', 'source', 'track', 'year', 'exam_month',
        ]));
    }

    private function adminId(Request $request): ?string
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        return $admin instanceof Admin ? (string) $admin->getKey() : null;
    }
}
