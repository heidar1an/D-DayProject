<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Services\Anatomy\AnatomyQueryService;
use Illuminate\Http\JsonResponse;

/**
 * آناتومی — عمومی، فاز ۱۵ (§18).
 *
 * فقط کاتالوگ منتشرشده. Detail endpoint ساخته نشد: viewer واقعی امروز هیچ
 * فراخوانی API ندارد و endpoint بدون مصرف‌کننده ساخته نمی‌شود.
 */
final class AnatomyController extends Controller
{
    public function __construct(
        private readonly AnatomyQueryService $query,
    ) {}

    public function assets(): JsonResponse
    {
        return ApiResponse::success(['assets' => $this->query->publishedCatalog()]);
    }
}
