<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Health\ReadinessChecker;
use App\Support\RequestId;
use Illuminate\Http\JsonResponse;

/**
 * Endpointهای سلامت زیرساخت (فقط فاز ۱):
 *  - GET /api/v1/healthz  → liveness: اپلیکیشن زنده است؛ هیچ وابستگی‌ای چک نمی‌شود.
 *  - GET /api/v1/readyz   → readiness: وابستگی‌های لازم (database / redis) بررسی می‌شوند.
 * شکل پاسخ health محدود و مخصوص خودش است و envelope استاندارد را نقض نمی‌کند
 * (مجاز طبق Blueprint؛ docs/api.md).
 */
class HealthController extends Controller
{
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'requestId' => RequestId::current(),
        ]);
    }

    public function ready(ReadinessChecker $checker): JsonResponse
    {
        $result = $checker->run();

        return response()->json([
            'status' => $result['ok'] ? 'ok' : 'unavailable',
            'checks' => $result['checks'],
            'requestId' => RequestId::current(),
        ], $result['ok'] ? 200 : 503);
    }
}
