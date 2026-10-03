<?php

namespace App\Services\Content;

use App\Exceptions\ApiErrorException;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonPage;
use App\Models\Subject;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

/**
 * خواندن محتوای منتشرشده — تنها مسیر query برای لایهٔ دانشجو.
 *
 * قاعده: هیچ‌چیزِ غیرمنتشرشده به این سرویس راه ندارد. «پیدا نشد» با ۴۰۴ پاسخ
 * داده می‌شود، نه ۴۰۳: وجود یک پیش‌نویس نباید لو برود (enumeration).
 */
class ContentQueryService
{
    public function __construct(private readonly ContentVisibility $visibility) {}

    /** @return Collection<int, Subject> */
    public function publishedSubjects(): Collection
    {
        return Subject::query()
            ->where('status', Subject::STATUS_PUBLISHED)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    public function publishedCourses(?string $subjectSlug, int $perPage): LengthAwarePaginator
    {
        return Course::query()
            ->published()
            ->whereHas('subject', fn ($query) => $query->where('status', Subject::STATUS_PUBLISHED))
            ->when($subjectSlug !== null && $subjectSlug !== '', function ($query) use ($subjectSlug): void {
                $query->whereHas('subject', fn ($inner) => $inner->where('slug', $subjectSlug));
            })
            ->with('subject:id,slug,title')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function publishedCourse(string $idOrSlug): Course
    {
        /*
         * ⚠️ مقایسهٔ `id` فقط وقتی انجام می‌شود که ورودی **شکل UUID** داشته باشد.
         *
         * ستون `courses.id` روی PostgreSQL از نوع `uuid` است و مقایسه‌اش با یک
         * رشتهٔ معمولی (`course-vel-dolorem`) خطای
         * `SQLSTATE[22P02] invalid input syntax for type uuid` می‌دهد ⇒ ۵۰۰ به‌جای
         * «با slug پیدا کن». SQLite این را تحمل می‌کند و باگ را پنهان می‌کرد.
         */
        $isUuid = Str::isUuid($idOrSlug);

        $course = Course::query()
            ->published()
            ->where(function ($query) use ($idOrSlug, $isUuid): void {
                $query->where('slug', $idOrSlug);

                if ($isUuid) {
                    $query->orWhere('id', $idOrSlug);
                }
            })
            ->with(['subject', 'chapters' => fn ($query) => $query->where('status', Lesson::STATUS_PUBLISHED)])
            ->first();

        if ($course === null || ! $this->visibility->courseIsVisible($course)) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Course not found.');
        }

        return $course;
    }

    public function publishedLesson(string $id): Lesson
    {
        $lesson = Lesson::query()->where('id', $id)->with(['chapter.course.subject', 'pages'])->first();

        if ($lesson === null || ! $this->visibility->lessonIsVisible($lesson)) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Lesson not found.');
        }

        return $lesson;
    }

    public function publishedPage(string $id): LessonPage
    {
        $page = LessonPage::query()->where('id', $id)->with('lesson.chapter.course.subject')->first();

        if ($page === null || ! $this->visibility->pageIsVisible($page)) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Lesson page not found.');
        }

        return $page;
    }
}
