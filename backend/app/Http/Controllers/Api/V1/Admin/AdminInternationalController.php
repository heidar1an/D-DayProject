<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\International\ListAdminInternationalRequest;
use App\Http\Requests\International\SetInternationalStatusRequest;
use App\Http\Requests\International\UpsertInternationalCourseRequest;
use App\Http\Requests\International\UpsertInternationalProviderRequest;
use App\Http\Resources\AdminInternationalCourseResource;
use App\Http\Resources\AdminInternationalProviderResource;
use App\Models\InternationalCourse;
use App\Models\InternationalProvider;
use App\Services\International\InternationalCatalogService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * مدیریت کاتالوگ بین‌الملل — فاز ۱۷.
 *
 *   GET    /api/v1/admin/international/providers
 *   POST   /api/v1/admin/international/providers
 *   PATCH  /api/v1/admin/international/providers/{id}
 *   POST   /api/v1/admin/international/providers/{id}/status
 *   GET    /api/v1/admin/international/courses
 *   POST   /api/v1/admin/international/courses
 *   PATCH  /api/v1/admin/international/courses/{id}
 *   POST   /api/v1/admin/international/courses/{id}/status
 *   DELETE /api/v1/admin/international/courses/{id}
 *
 * چرا این مسیرها ساخته شدند (برخلاف قاعدهٔ «بدون مصرف‌کنندهٔ واقعی endpoint
 * نساز»): مصرف‌کنندهٔ واقعی وجود دارد — `src/layout/admin/views/AdminIntlCourses.jsx`
 * و کلیدهای مجوز `intl.*` از قبل در RBAC واقعی پنل هستند
 * (`database/contentStore.js`). پس این مسیرها واژگان و مصرف‌کنندهٔ تازه‌ای
 * اختراع نمی‌کنند.
 *
 * ⚠️ هیچ مسیر ادمینی برای **آزمون بین‌الملل** ساخته نشد: پنل فعلی CRUD آزمون
 * ندارد و قاعدهٔ فاز ۷ («endpoint بی‌مصرف، طراحی را جای پیاده‌سازی جا می‌زند»)
 * دست‌نخورده است. آزمون بین‌الملل با `ExamService` ساخته می‌شود.
 */
class AdminInternationalController extends Controller
{
    public function __construct(private readonly InternationalCatalogService $catalog) {}

    /* ── ناشر ── */

    public function providers(ListAdminInternationalRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('international.pagination.per_page'));

        $paginator = $this->catalog->adminProviders($data['status'] ?? null, $perPage);

        return ApiResponse::success(
            ['providers' => AdminInternationalProviderResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function storeProvider(UpsertInternationalProviderRequest $request): JsonResponse
    {
        $provider = $this->catalog->createProvider($request->validated());

        return ApiResponse::success(['provider' => new AdminInternationalProviderResource($provider)], null, 201);
    }

    public function updateProvider(UpsertInternationalProviderRequest $request, string $id): JsonResponse
    {
        $provider = $this->catalog->updateProvider($this->provider($id), $request->validated());

        return ApiResponse::success(['provider' => new AdminInternationalProviderResource($provider)]);
    }

    public function setProviderStatus(SetInternationalStatusRequest $request, string $id): JsonResponse
    {
        $provider = $this->catalog->setProviderStatus($this->provider($id), (string) $request->validated()['status']);

        return ApiResponse::success(['provider' => new AdminInternationalProviderResource($provider)]);
    }

    /* ── دوره ── */

    public function courses(ListAdminInternationalRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('international.pagination.per_page'));

        $paginator = $this->catalog->adminCourses(
            $data['status'] ?? null,
            $data['providerId'] ?? null,
            $perPage,
        );

        return ApiResponse::success(
            ['courses' => AdminInternationalCourseResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function storeCourse(UpsertInternationalCourseRequest $request): JsonResponse
    {
        $course = $this->catalog->createCourse($request->validated());

        return ApiResponse::success(
            ['course' => new AdminInternationalCourseResource($course->load('provider'))],
            null,
            201,
        );
    }

    public function updateCourse(UpsertInternationalCourseRequest $request, string $id): JsonResponse
    {
        $course = $this->catalog->updateCourse($this->course($id), $request->validated());

        return ApiResponse::success(['course' => new AdminInternationalCourseResource($course->load('provider'))]);
    }

    public function setCourseStatus(SetInternationalStatusRequest $request, string $id): JsonResponse
    {
        $course = $this->catalog->setCourseStatus($this->course($id), (string) $request->validated()['status']);

        return ApiResponse::success(['course' => new AdminInternationalCourseResource($course->load('provider'))]);
    }

    public function destroyCourse(string $id): JsonResponse
    {
        $this->catalog->deleteCourse($this->course($id));

        return ApiResponse::success(['deleted' => true]);
    }

    /**
     * شناسه در مسیر با `whereUuid` قید شده، پس اینجا فقط «پیدا نشد» ممکن است —
     * و همان ۴۰۴ قراردادی است، نه ۵۰۰.
     */
    private function provider(string $id): InternationalProvider
    {
        $provider = InternationalProvider::query()->find($id);

        if ($provider === null) {
            abort(404);
        }

        return $provider;
    }

    private function course(string $id): InternationalCourse
    {
        $course = InternationalCourse::query()->find($id);

        if ($course === null) {
            abort(404);
        }

        return $course;
    }
}
