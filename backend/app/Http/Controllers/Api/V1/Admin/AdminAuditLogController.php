<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Api\V1\Admin\Concerns\ResolvesAdmin;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListAuditLogsRequest;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Services\Audit\AuditLogger;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * مشاهدهٔ Audit log — فاز ۲۰ (§82).
 *
 * فقط خواندن: هیچ مسیری audit را ویرایش/حذف نمی‌کند و مدل هم قفل است.
 * دسترسی با کلید واقعی `logs.read`.
 */
final class AdminAuditLogController extends Controller
{
    use ResolvesAdmin;

    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    public function index(ListAuditLogsRequest $request): JsonResponse
    {
        $perPage = (int) ($request->validated('perPage') ?? config('audit.pagination.per_page'));

        $paginator = $this->audit->list($request->validated(), $perPage);

        return ApiResponse::success(
            ['logs' => AuditLogResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function show(string $id): JsonResponse
    {
        $log = AuditLog::query()->whereKey($id)->first();

        if (! $log instanceof AuditLog) {
            abort(404);
        }

        return ApiResponse::success(['log' => new AuditLogResource($log)]);
    }
}
