<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Analytics\AnalyticsQueryRequest;
use App\Http\Resources\AnalyticsOverviewResource;
use App\Http\Resources\ExamAnalyticsResource;
use App\Http\Resources\ProgressAnalyticsResource;
use App\Http\Resources\TopicAnalyticsResource;
use App\Services\Analytics\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * تحلیل کاربر جاری — فاز ۸.
 *
 *   GET /api/v1/me/analytics/overview
 *   GET /api/v1/me/analytics/topics
 *   GET /api/v1/me/analytics/exams
 *   GET /api/v1/me/analytics/progress
 *
 * همه زیر `/me/*` و همه نیازمند سشن دانشجو. **هیچ `userId` ای از URL یا بدنه
 * خوانده نمی‌شود**؛ تنها منبع مالکیت سشن است. هیچ مسیری برای خواندن تحلیل کاربر
 * دیگر از سمت دانشجو وجود ندارد، پس IDOR ساختاراً ناممکن است.
 *
 * تحلیل سطح‌کاربری برای ادمین در این فاز ساخته **نشده**: هیچ مصرف‌کننده‌ای در پنل
 * فعلی وجود ندارد و ساختن endpoint بدون مصرف‌کننده، «طراحی‌شده» را جای
 * «پیاده‌شده» جا می‌زند.
 */
class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    public function overview(AnalyticsQueryRequest $request): JsonResponse
    {
        return ApiResponse::success([
            'analytics' => (new AnalyticsOverviewResource($this->analytics->overview($request->user())))->resolve(),
        ]);
    }

    public function topics(AnalyticsQueryRequest $request): JsonResponse
    {
        return ApiResponse::success([
            'analytics' => (new TopicAnalyticsResource($this->analytics->topics($request->user())))->resolve(),
        ]);
    }

    public function exams(AnalyticsQueryRequest $request): JsonResponse
    {
        return ApiResponse::success([
            'analytics' => (new ExamAnalyticsResource($this->analytics->exams($request->user())))->resolve(),
        ]);
    }

    public function progress(AnalyticsQueryRequest $request): JsonResponse
    {
        $data = $request->validated();
        $timezone = (string) ($data['tz'] ?? config('app.timezone'));

        return ApiResponse::success([
            'analytics' => (new ProgressAnalyticsResource($this->analytics->progress(
                $request->user(),
                (string) ($data['bucket'] ?? 'daily'),
                $timezone,
                isset($data['from']) ? Carbon::parse($data['from']) : null,
                isset($data['to']) ? Carbon::parse($data['to']) : null,
            )))->resolve(),
            'meta' => ['timezone' => $timezone, 'bucket' => $data['bucket'] ?? 'daily'],
        ]);
    }
}
