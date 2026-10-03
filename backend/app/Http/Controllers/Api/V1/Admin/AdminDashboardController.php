<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Api\V1\Admin\Concerns\ResolvesAdmin;
use App\Http\Controllers\Controller;
use App\Services\Admin\AdminDashboardService;
use Illuminate\Http\JsonResponse;

/**
 * داشبورد پنل — فاز ۲۰ (§90).
 *
 * همهٔ اعداد از منبع واقعی‌اند؛ هیچ Mock اینجا نیست.
 */
final class AdminDashboardController extends Controller
{
    use ResolvesAdmin;

    public function __construct(
        private readonly AdminDashboardService $dashboard,
    ) {}

    public function overview(): JsonResponse
    {
        return ApiResponse::success(['dashboard' => $this->dashboard->overview()]);
    }
}
