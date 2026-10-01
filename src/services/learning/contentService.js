import anatomyCourse from '../../data/learning/anatomyCourse';
import { MICRO_COURSE_REGISTRY } from '../../data/micro/registry.js';

/* درس‌هایی که مسیر یادگیری دست‌نویس دارند: واحدهای کامل با مراحل یادگیری و فعالیت‌ها. */
const AUTHORED_COURSES = {
  anatomy: anatomyCourse,
};

/*
 * لایهٔ درسنامهٔ جامعِ بقیهٔ درس‌ها از میکرودرسنامهٔ همان درس ساخته می‌شود: هر «مبحث»
 * یک کادر سرتیتر (بخش) ستون راست است و واحدهای یادگیری همان مبحث، کارت‌های ستون چپ —
 * همان ساختاری که لایهٔ آناتومی دارد. هر واحد مقصد خودش را هم با خود می‌آورد (`micro`)
 * تا کلیک روی کارتش همان مبحث را در خوانندهٔ میکرودرسنامه باز کند.
 *
 * نتیجه: «تعداد درسنامه» هر درس روی کارت‌های درسنامهٔ جامع از محتوای واقعی همان درس
 * می‌آید و با انتشار مبحث/واحد تازه خودش بالا می‌رود — هیچ فهرست دستی‌ای در کار نیست.
 */
function courseFromMicro(course) {
  const modules = course.topics.map((topic, index) => ({
    id: topic.id,
    order: index + 1,
    title: topic.title,
    description: topic.description ?? '',
    accent: topic.accent ?? course.accent,
    unitCount: (topic.units ?? []).length,
    progress: 0,
    status: 'fresh',
  }));

  const unitsByModule = {};
  for (const topic of course.topics) {
    unitsByModule[topic.id] = (topic.units ?? []).map((unit) => ({
      id: unit.id,
      moduleId: topic.id,
      title: unit.title,
      estimatedTime: unit.estimatedTime ?? 0,
      progress: 0,
      mastery: 0,
      status: 'fresh',
      micro: { courseId: course.id, topicId: topic.id },
    }));
  }

  return {
    id: course.id,
    title: course.title,
    subtitle: course.description,
    modules,
    unitsByModule,
  };
}

const COURSE_REGISTRY = {
  ...AUTHORED_COURSES,
  ...Object.fromEntries(
    Object.values(MICRO_COURSE_REGISTRY)
      .filter((course) => !AUTHORED_COURSES[course.id])
      .map((course) => [course.id, courseFromMicro(course)]),
  ),
};

/*
 * ── نسخهٔ منتشرشدهٔ پنل ──
 *
 * درسنامهٔ جامعی که مدیر در پنل ویرایش و «انتشار» می‌کند، منبعش سرور است
 * (`GET /api/public/comprehensive/library`) نه رجیستری ثابت — همان الگوی
 * `/api/public/micro/library` و `/api/public/flashcards/library`. رکورد
 * منتشرشده **جای** نسخهٔ ثابت را می‌گیرد، نه کنارش؛ رجیستری سرجایش می‌ماند
 * تا نبودِ سرور (پیش‌نمایش استاتیک) لایه را از کار نیندازد.
 *
 * کش کوتاه‌مدت است چون این تابع پرتکرار است؛ خطا هم بالا نمی‌دهد.
 */
const PUBLISHED_TTL_MS = 15000;

let publishedCourses = [];
let publishedAt = 0;
let publishedPending = null;

export async function loadPublishedCourses({ force = false } = {}) {
  if (!force && publishedAt && Date.now() - publishedAt < PUBLISHED_TTL_MS) return publishedCourses;
  if (publishedPending) return publishedPending;

  publishedPending = (async () => {
    try {
      const response = await fetch('/api/public/comprehensive/library', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`comprehensive-library-http-${response.status}`);
      const payload = await response.json();
      const courses = payload?.data?.courses;
      if (Array.isArray(courses)) publishedCourses = courses.filter((course) => course?.id);
    } catch {
      /* سرور در دسترس نیست — رجیستری ثابت پاسخ می‌دهد */
    } finally {
      publishedAt = Date.now();
      publishedPending = null;
    }
    return publishedCourses;
  })();

  return publishedPending;
}

/* نسخهٔ منتشرشدهٔ یک درس، اگر پنل آن را منتشر کرده باشد */
function publishedCourse(courseId) {
  return publishedCourses.find((course) => course.id === courseId) ?? null;
}

/*
 * خواندن دوبارهٔ کتابخانهٔ منتشرشده، بدون توجه به کش.
 *
 * چرا لازم است: مدیر در پنل واحدها را ویرایش و «ذخیره/انتشار» می‌کند، ولی کش
 * ۱۵ ثانیه‌ای اینجا یعنی ورود بعدی کاربر ممکن است همان نسخهٔ کهنه را ببیند —
 * همان «تغییرات پنل اعمال نمی‌شود». هر بار که لایهٔ یک درس باز می‌شود یک
 * درخواست تازه می‌فرستیم؛ هزینه‌اش ناچیز است و تضمین می‌کند آنچه مدیر ذخیره
 * کرده همان لحظه دیده شود.
 */
export function refreshLibrary() {
  return loadPublishedCourses({ force: true });
}

/**
 * قرارداد دسترسی به محتوا. پیاده‌سازی امروز از داده محلی می‌خواند؛ نسخه API فقط
 * کافی است بدنه این متدها را عوض کند.
 */
export const ContentService = {
  async getCourse(courseId, { signal, force = false } = {}) {
    await loadPublishedCourses({ force });

    if (signal?.aborted) {
      throw new DOMException('درخواست لغو شد', 'AbortError');
    }

    const course = publishedCourse(courseId) ?? COURSE_REGISTRY[courseId];
    if (!course) throw new Error('محتوای این درس پیدا نشد.');
    return course;
  },

  getModule(course, moduleId) {
    return course.modules.find((module) => module.id === moduleId) ?? null;
  },

  getUnits(course, moduleId) {
    return course.unitsByModule[moduleId] ?? [];
  },

  getUnit(course, unitId) {
    return Object.values(course.unitsByModule)
      .flat()
      .find((unit) => unit.id === unitId) ?? null;
  },

  /* آیا این درس لایهٔ درسنامهٔ جامع دارد؟ مبنای تصمیم «کارت درس باز می‌شود یا نه». */
  hasCourse(courseId) {
    return Boolean(publishedCourse(courseId) ?? COURSE_REGISTRY[courseId]);
  },

  /* تعداد کادرهای سرتیتر (بخش‌های) لایهٔ یک درس — منبع شمارش «تعداد درسنامه» روی
     کارت‌های «درسنامهٔ جامع». نسخهٔ منتشرشدهٔ پنل اگر خوانده شده باشد مقدم است. */
  countSections(subjectId) {
    return (publishedCourse(subjectId) ?? COURSE_REGISTRY[subjectId])?.modules?.length ?? 0;
  },
};

export default ContentService;
