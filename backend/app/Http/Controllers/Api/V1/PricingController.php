<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Commerce\QuoteRequest;
use App\Services\Commerce\PricingService;
use Illuminate\Http\JsonResponse;

/**
 * قیمت‌گذاری (عمومی) — فاز ۱۸.
 *
 *   GET  /api/v1/pricing/plans
 *   POST /api/v1/pricing/quote
 *
 * `plans` فقط محصول/طرح فعال را برمی‌گرداند؛ طرح `draft`/`archived` وجود ندارد
 * (۴۰۴). طرح فعالِ تأییدنشده دیده می‌شود ولی `purchasable: false` است — نمایش و
 * اجازهٔ خرید دو چیز جدا هستند (§29/§68).
 *
 * `quote` هیچ مبلغی از کلاینت نمی‌پذیرد؛ فقط (محصول، چرخه، صندلی) و سرور عدد
 * می‌سازد (§30).
 */
class PricingController extends Controller
{
    public function __construct(private readonly PricingService $pricing) {}

    public function plans(): JsonResponse
    {
        return ApiResponse::success($this->pricing->catalog());
    }

    public function quote(QuoteRequest $request): JsonResponse
    {
        $data = $request->validated();

        $plan = $this->pricing->resolvePlan((string) $data['planId'], (string) $data['cycleId']);

        $quote = $this->pricing->quote($plan, (string) $data['cycleId'], (int) ($data['seats'] ?? 1));

        return ApiResponse::success(['quote' => $quote]);
    }
}
