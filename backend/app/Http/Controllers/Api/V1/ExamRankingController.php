<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Resources\RankingResource;
use App\Services\Exam\ExamRankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * رتبه‌بندی — فاز ۷.
 *
 *   GET /api/v1/exams/{idOrSlug}/ranking
 *
 * عمومی است (تجمیع، بدون PII) ولی `me` فقط برای کاربر وارد‌شده پر می‌شود.
 *
 * **صفحه‌بندی لازم نیست چون فهرست شرکت‌کننده‌ای وجود ندارد.** خروجی فقط تجمیع
 * (`participants_count`, `top_percent`, `median_percent`, `average_percent`) و
 * رتبهٔ خودِ کاربر است. این عمدی است: هر leaderboard با نام/شناسه، PII افشا
 * می‌کند و در این فاز هیچ مصرف‌کنندهٔ UI ای برایش وجود ندارد.
 *
 * پیش از انتشار نتایج، رتبه‌بندی وجود ندارد (۴۰۹) — رتبه خودش بخشی از کارنامه است.
 */
class ExamRankingController extends Controller
{
    public function __construct(private readonly ExamRankingService $ranking) {}

    public function index(Request $request, string $idOrSlug): JsonResponse
    {
        return ApiResponse::success([
            'ranking' => (new RankingResource($this->ranking->ranking($request->user(), $idOrSlug)))->resolve(),
        ]);
    }
}
