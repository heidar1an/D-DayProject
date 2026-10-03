<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveApiSession;
use App\Http\Requests\Feedback\Admin\AdminFeedbackRequest;
use App\Http\Requests\Feedback\Admin\ReplyFeedbackRequest;
use App\Models\Admin;
use App\Models\Feedback;
use App\Services\Feedback\FeedbackService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * پنل بازخورد — فاز ۱۶ (§48/§49).
 *
 * مجوزهای واقعی پنل: `feedback.read` (دیدن) و `feedback.manage` (پاسخ/وضعیت) —
 * از AdminRbacSeeder. `adminId` هرگز از بدنه نمی‌آید (§49).
 */
final class AdminFeedbackController extends Controller
{
    public function __construct(
        private readonly FeedbackService $feedback,
    ) {}

    public function index(AdminFeedbackRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated('perPage') ?? config('feedback.pagination.per_page'));

        $paginator = $this->feedback->adminList($request->validated(), $perPage);

        return ApiResponse::success(
            ['feedback' => collect($paginator->items())->map(fn (Feedback $row) => $this->adminRow($row))->values()->all()],
            Pagination::meta($paginator),
        );
    }

    public function show(string $id): JsonResponse
    {
        return ApiResponse::success(['feedback' => $this->adminRow($this->feedbackOrFail($id), true)]);
    }

    public function reply(ReplyFeedbackRequest $request, string $id): JsonResponse
    {
        $feedback = $this->feedbackOrFail($id);

        $reply = $this->feedback->reply($this->admin($request), $feedback, (string) $request->validated('body'));

        return ApiResponse::success(['reply' => ['id' => $reply->getKey(), 'createdAt' => $reply->created_at?->toIso8601String()]], null, 201);
    }

    public function updateStatus(AdminFeedbackRequest $request, string $id): JsonResponse
    {
        $feedback = $this->feedbackOrFail($id);
        $feedback->forceFill(['status' => (string) $request->validated('status')])->save();

        return ApiResponse::success(['feedback' => $this->adminRow($feedback)]);
    }

    private function feedbackOrFail(string $id): Feedback
    {
        /** @var Feedback|null */
        $feedback = Feedback::query()->with('replies')->whereKey($id)->first();

        if (! $feedback instanceof Feedback) {
            abort(404);
        }

        return $feedback;
    }

    /** @return array<string, mixed> */
    private function adminRow(Feedback $feedback, bool $withBody = false): array
    {
        return [
            'id' => $feedback->getKey(),
            'source' => $feedback->source,
            'subject' => $feedback->subject,
            'category' => $feedback->category,
            'status' => $feedback->status,
            'userRef' => $feedback->user_id !== null
                ? ['type' => 'user', 'id' => (string) $feedback->user_id]
                : ($feedback->guest_ref !== null ? ['type' => 'guest', 'id' => $feedback->guest_ref] : null),
            'body' => $withBody ? $feedback->body : null,
            'meta' => $feedback->meta,
            'repliesCount' => (int) $feedback->replies->count(),
            'createdAt' => $feedback->created_at?->toIso8601String(),
        ];
    }

    private function admin(Request $request): Admin
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            abort(401);
        }

        return $admin;
    }
}
