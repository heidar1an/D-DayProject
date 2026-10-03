<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Content\ListCoursesRequest;
use App\Http\Resources\CourseResource;
use App\Http\Resources\LessonPageResource;
use App\Http\Resources\LessonResource;
use App\Http\Resources\SubjectResource;
use App\Services\Content\ContentQueryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * محتوای منتشرشده — فاز ۴ (پیش‌نیاز فاز ۵).
 *
 *   GET /api/v1/subjects
 *   GET /api/v1/courses?subject=&page=&perPage=
 *   GET /api/v1/courses/{idOrSlug}
 *   GET /api/v1/lessons/{id}
 *   GET /api/v1/lesson-pages/{id}
 *
 * همهٔ این‌ها عمومی‌اند (محتوای رایگان منتشرشده). محتوای غیرمنتشرشده ۴۰۴ می‌گیرد،
 * نه ۴۰۳ — وجود پیش‌نویس نباید لو برود.
 *
 * CRUD ادمین محتوا (بخشی از فاز ۴) در این نوبت ساخته نشد؛ در گزارش به‌عنوان
 * بدهی باز ثبت شده است.
 */
class ContentController extends Controller
{
    public function __construct(private readonly ContentQueryService $content) {}

    public function subjects(): JsonResponse
    {
        return ApiResponse::success([
            'subjects' => SubjectResource::collection($this->content->publishedSubjects()),
        ]);
    }

    public function courses(ListCoursesRequest $request): JsonResponse
    {
        $data = $request->validated();
        $perPage = (int) ($data['perPage'] ?? config('content.pagination.per_page'));

        $paginator = $this->content->publishedCourses($data['subject'] ?? null, $perPage);

        return ApiResponse::success(
            ['courses' => CourseResource::collection($paginator->items())],
            Pagination::meta($paginator),
        );
    }

    public function showCourse(string $idOrSlug): JsonResponse
    {
        return ApiResponse::success([
            'course' => new CourseResource($this->content->publishedCourse($idOrSlug)),
        ]);
    }

    public function showLesson(string $id): JsonResponse
    {
        $lesson = $this->content->publishedLesson($id);
        $lesson->setRelation('pages', $lesson->pages->where('status', 'published')->values());

        return ApiResponse::success(['lesson' => new LessonResource($lesson)]);
    }

    public function showPage(string $id): JsonResponse
    {
        return ApiResponse::success([
            'page' => new LessonPageResource($this->content->publishedPage($id)),
        ]);
    }
}
