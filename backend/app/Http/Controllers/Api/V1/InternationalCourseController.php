<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\International\ListInternationalCoursesRequest;
use App\Http\Resources\InternationalCourseResource;
use App\Http\Resources\InternationalProviderResource;
use App\Services\International\InternationalCatalogService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * کاتالوگ بین‌الملل (عمومی) — فاز ۱۷.
 *
 *   GET /api/v1/international/providers
 *   GET /api/v1/international/courses?provider=&category=&search=&page=&perPage=
 *   GET /api/v1/international/courses/{slug}
 *
 * Controller **thin** است: هیچ فیلتری، هیچ محاسبهٔ دسترسی و هیچ query اینجا
 * نیست. فقط سرویس را صدا می‌زند و Resource می‌سازد.
 *
 * ⚠️ سه مسیر موازی ساخته **نشد** و دلیلش صریح است:
 *
 *   • `.../{slug}/chapters` — فصل‌ها/درس‌ها/صفحه‌ها از Content API عمومی موجود
 *     (`GET /api/v1/courses/{idOrSlug}`، `/lessons/{id}`، `/lesson-pages/{id}`)
 *     سرو می‌شوند. endpoint موازی یعنی دو منبع حقیقت برای یک محتوا (Prompt §9).
 *   • `.../exams` و `.../exams/{id}` — آزمون بین‌الملل روی همان `exams` با
 *     `kind = international` است و **همین حالا** از
 *     `GET /api/v1/exams?kind=international` و `GET /api/v1/exams/{idOrSlug}`
 *     با محاسبهٔ کامل وضعیت کاربر سرو می‌شود. ساختن مسیر تازه، موتور و
 *     قرارداد دومی می‌ساخت (Prompt §12/§14).
 *   • مسیر Attempt/Result — همان `/exams/{idOrSlug}/attempts` موتور آزمون.
 */
class InternationalCourseController extends Controller
{
    public function __construct(private readonly InternationalCatalogService $catalog) {}

    public function providers(): JsonResponse
    {
        return ApiResponse::success([
            'providers' => InternationalProviderResource::collection($this->catalog->publishedProviders()),
        ]);
    }

    public function courses(ListInternationalCoursesRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('international.pagination.per_page'));

        $paginator = $this->catalog->publishedCourses(
            $data['provider'] ?? null,
            $data['category'] ?? null,
            $data['search'] ?? null,
            $perPage,
        );

        $courses = collect($paginator->items());

        $access = $this->catalog->capabilityAccess(
            $request->user(),
            $courses->pluck('required_capability')->filter()->unique()->values()->all(),
        );

        return ApiResponse::success(
            [
                'courses' => $courses
                    ->map(fn ($course) => (new InternationalCourseResource($course))
                        ->additional(['locked' => $course->isPremium() && ! ($access[$course->required_capability] ?? true)]))
                    ->all(),
            ],
            Pagination::meta($paginator),
        );
    }

    public function showCourse(ListInternationalCoursesRequest $request, string $slug): JsonResponse
    {
        $result = $this->catalog->publishedCourse($slug, $request->user());

        /*
         * فهرست = کاتالوگ (دوره با `locked: true` دیده می‌شود تا UI paywall
         * بسازد)، جزئیات = دسترسی به محتوا (قفل ⇒ ۴۰۳). تفکیک عمدی است:
         * «وجود دارد» و «می‌توانی بازش کنی» دو پرسش جدا هستند.
         */
        $this->catalog->assertAccessible($result['course'], $request->user());

        return ApiResponse::success([
            'course' => (new InternationalCourseResource($result['course']))->additional(['locked' => $result['locked']]),
        ]);
    }
}
