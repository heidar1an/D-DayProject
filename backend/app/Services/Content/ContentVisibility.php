<?php

namespace App\Services\Content;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonPage;
use App\Models\Subject;

/**
 * تنها تعریف «این محتوا برای دانشجو دیده می‌شود؟» — جای دیگری تکرار نشود.
 *
 * قاعده: زنجیره باید **کامل** منتشرشده باشد. یک صفحهٔ published زیر درسِ draft
 * نباید دیده شود؛ وگرنه «پیش‌نویس» بی‌معنا می‌شد و انتشار یک درس اثر نداشت.
 *
 * چرا سرویس و نه Policy: این تابع هم در Policy، هم در سرویس پیشرفت (فاز ۵) و
 * هم در انتخاب سؤال (فاز ۶) لازم است. تکرارش در سه جا یعنی سه رفتار واگرا.
 */
class ContentVisibility
{
    public function pageIsVisible(LessonPage $page): bool
    {
        if (! $page->isPublished()) {
            return false;
        }

        $page->loadMissing('lesson.chapter.course.subject');

        return $this->lessonIsVisible($page->lesson);
    }

    public function lessonIsVisible(?Lesson $lesson): bool
    {
        if ($lesson === null || $lesson->status !== Lesson::STATUS_PUBLISHED) {
            return false;
        }

        $lesson->loadMissing('chapter.course.subject');

        return $this->courseIsVisible($lesson->chapter?->course)
            && $lesson->chapter?->status === Lesson::STATUS_PUBLISHED;
    }

    public function courseIsVisible(?Course $course): bool
    {
        if ($course === null || $course->status !== Course::STATUS_PUBLISHED) {
            return false;
        }

        $course->loadMissing('subject');

        return $course->subject instanceof Subject && $course->subject->isPublished();
    }
}
