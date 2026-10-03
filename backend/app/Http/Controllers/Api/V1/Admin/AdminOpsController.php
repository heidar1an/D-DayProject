<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Api\V1\Admin\Concerns\ResolvesAdmin;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListDeliveriesRequest;
use App\Http\Requests\Admin\ListFailedJobsRequest;
use App\Http\Requests\Admin\RebuildSearchRequest;
use App\Jobs\RebuildSearchIndexJob;
use App\Services\Admin\AdminOpsQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * عملیات پنل — فاز ۲۰ (§10/§88/§89).
 *
 *   GET  /admin/queue/failed           Dead letter با metadata امن (بدون payload خام)
 *   POST /admin/queue/failed/{id}/retry
 *   GET  /admin/search/status          وضعیت ایندکس
 *   POST /admin/search/rebuild         بازسازی (صف‌شده، نه درخواست طولانی)
 *   GET  /admin/notifications/deliveries
 *   POST /admin/notifications/deliveries/{id}/retry
 *
 * هیچ‌کدام دادهٔ Domain را مستقیم mutate نمی‌کنند؛ فقط زیرساخت و projection (§113).
 */
final class AdminOpsController extends Controller
{
    use ResolvesAdmin;

    public function __construct(
        private readonly AdminOpsQueryService $ops,
    ) {}

    public function failedJobs(ListFailedJobsRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated('perPage') ?? config('queue.tapesh.dead_letter.prune_batch', 50));

        $result = $this->ops->failedJobs(
            $request->validated(),
            (int) ($request->validated('page') ?? 1),
            $perPage,
        );

        return ApiResponse::success(
            ['jobs' => $result['items']],
            [
                'page' => $result['page'],
                'perPage' => $result['perPage'],
                'total' => $result['total'],
                'lastPage' => $result['lastPage'],
            ],
        );
    }

    public function retryFailedJob(Request $request, string $id): JsonResponse
    {
        if (! $this->ops->retryFailedJob($id)) {
            abort(404);
        }

        return ApiResponse::success(['retried' => true]);
    }

    public function searchStatus(): JsonResponse
    {
        return ApiResponse::success(['index' => $this->ops->searchStatus()]);
    }

    public function rebuildSearch(RebuildSearchRequest $request): JsonResponse
    {
        $entityType = $request->validated('entityType');

        RebuildSearchIndexJob::dispatch($entityType !== null ? (string) $entityType : null);

        return ApiResponse::success(['queued' => true], null, 202);
    }

    public function deliveries(ListDeliveriesRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated('perPage') ?? config('notifications.pagination.per_page'));

        $paginator = $this->ops->deliveries($request->validated(), $perPage);

        $items = collect($paginator->items())->map(fn ($delivery) => [
            'id' => $delivery->getKey(),
            'notificationId' => (string) $delivery->notification_id,
            'userId' => $delivery->notification?->user_id,
            'type' => $delivery->notification?->type,
            'channel' => (string) $delivery->channel,
            'status' => (string) $delivery->status,
            'attempts' => (int) $delivery->attempts,
            'lastErrorCode' => $delivery->last_error_code,
            'createdAt' => $delivery->created_at?->toIso8601String(),
        ])->values()->all();

        return ApiResponse::success(['deliveries' => $items], Pagination::meta($paginator));
    }

    public function retryDelivery(Request $request, string $id): JsonResponse
    {
        $delivery = $this->ops->retryDelivery($id);

        if ($delivery === null) {
            abort(404);
        }

        return ApiResponse::success([
            'delivery' => [
                'id' => $delivery->getKey(),
                'status' => (string) $delivery->status,
            ],
        ]);
    }
}
