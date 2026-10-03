<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Exam\FinishExamAttemptRequest;
use App\Http\Requests\Exam\SaveExamAnswerRequest;
use App\Http\Requests\Exam\StartExamAttemptRequest;
use App\Http\Resources\ExamAnswerResource;
use App\Http\Resources\ExamAttemptResource;
use App\Http\Resources\ExamQuestionResource;
use App\Http\Resources\ExamResultResource;
use App\Models\ExamAttempt;
use App\Models\ExamResult;
use App\Services\Exam\ExamAttemptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Attempt آزمون — فاز ۷.
 *
 *   POST /api/v1/exams/{idOrSlug}/attempts
 *   GET  /api/v1/exam-attempts/{id}
 *   PUT  /api/v1/exam-attempts/{id}/answers
 *   POST /api/v1/exam-attempts/{id}/finish
 *
 * Controller **thin** است: هیچ محاسبه‌ای اینجا نیست. مالکیت، مهلت، اعتبارسنجی
 * گزینه و تصحیح همه در `ExamAttemptService` و `ExamGrader` انجام می‌شوند.
 *
 * ⚠️ هیچ‌کدام از این مسیرها `userId` نمی‌پذیرند. مالکیت از سشن می‌آید و
 * Attempt کاربر دیگر ۴۰۴ می‌گیرد (نه ۴۰۳ — وجودش نباید لو برود).
 */
class ExamAttemptController extends Controller
{
    use ReadsIdempotencyKey;

    public function __construct(private readonly ExamAttemptService $attempts) {}

    public function store(StartExamAttemptRequest $request, string $idOrSlug): JsonResponse
    {
        $outcome = $this->attempts->start(
            $request->user(),
            $idOrSlug,
            $this->idempotencyKey($request),
            fn (array $payload): array => [
                'attempt' => (new ExamAttemptResource($payload['attempt']))->resolve(),
                /* سؤال‌ها در همان پاسخ شروع می‌آیند تا UI یک رفت‌وبرگشت صرفه‌جویی
                   کند — و **هیچ کلید پاسخی** همراهشان نیست. */
                'questions' => ExamQuestionResource::collection($payload['questions'])->resolve(),
                'resumed' => $payload['resumed'],
            ],
        );

        return ApiResponse::success($outcome->data, $outcome->meta, $outcome->status);
    }

    public function show(Request $request, string $attemptId): JsonResponse
    {
        $result = $this->attempts->show($request->user(), $attemptId);

        return ApiResponse::success([
            'attempt' => (new ExamAttemptResource($result['attempt']))->resolve(),
            'questions' => ExamQuestionResource::collection($result['questions'])->resolve(),
        ]);
    }

    public function saveAnswer(SaveExamAnswerRequest $request, string $attemptId): JsonResponse
    {
        $data = $request->validated();

        $payload = $this->attempts->saveAnswer(
            $request->user(),
            $attemptId,
            (string) $data['questionId'],
            $data['selectedOptionId'],
            (int) $data['revision'],
            $data['timeSpent'] ?? null,
            fn ($answer): array => [
                'answer' => (new ExamAnswerResource($answer))->resolve(),
                /* نسخهٔ جاری برای save بعدی — کلاینت باید همین را برگرداند. */
                'revision' => (int) $answer->revision,
            ],
        );

        return ApiResponse::success($payload);
    }

    public function finish(FinishExamAttemptRequest $request, string $attemptId): JsonResponse
    {
        $outcome = $this->attempts->finish(
            $request->user(),
            $attemptId,
            $this->idempotencyKey($request),
            function (array $payload): array {
                /*
                 * ⚠️ نتیجه **فقط اگر released باشد** در بدنه می‌آید.
                 *
                 * تفاوت عمدی با legacy: `submitAttemptFor` در `examStore.js` نتیجه را
                 * بلافاصله برمی‌گرداند، حتی وقتی `resultReleaseAt` آینده است — یعنی
                 * کاربر می‌توانست با نگاه‌کردن به پاسخ submit، نمره را پیش از موعد
                 * ببیند. اینجا دروازهٔ انتشار روی **همهٔ** مسیرها اعمال می‌شود.
                 */
                $result = $this->releasedResult($payload);

                return [
                    'attempt' => (new ExamAttemptResource($payload['attempt']))->resolve(),
                    'result' => $result,
                    'result_released' => $result !== null,
                    'idempotent' => $payload['idempotent'],
                ];
            },
        );

        return ApiResponse::success($outcome->data, $outcome->meta, $outcome->status);
    }

    /** @param array{attempt: ExamAttempt, result: ?ExamResult, idempotent: bool} $payload */
    private function releasedResult(array $payload): ?array
    {
        $attempt = $payload['attempt'];
        $result = $payload['result'];

        if ($result === null) {
            return null;
        }

        $exam = $attempt->exam;

        if ($exam->result_release_at !== null && $exam->result_release_at->isFuture()) {
            return null;
        }

        return (new ExamResultResource($result))->resolve();
    }
}
