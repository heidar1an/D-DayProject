/*
 * سرویس محتوای میکرودرسنامه — قرارداد دسترسی به درس‌ها و مبحث‌ها.
 * خوانندهٔ درس از مسیر عمومی `/api/public/micro/library` می‌آید (نسخه‌ای که ادمین
 * منتشر کرده) و در نبودِ آن به رجیستری ثابت `src/data/micro/registry.js` برمی‌گردد؛
 * امضا و شکل Entity در هر دو حالت یکی است.
 *
 * سلسله‌مراتب: درس (subject) → مبحث (topic) → واحد یادگیری → صفحه‌های میکرو.
 * پرچم `published` فقط «آمادگی محتوا» را نشان می‌دهد (مسیر پیش‌فرض ورود به خواننده و
 * انتخاب مبحث پیش‌فرض در getTopic)؛ در رابط کاربری هیچ حالتی را پنهان نمی‌کند —
 * همهٔ مبحث‌ها در فهرست فعال‌اند و مبحث بدون واحد، پیام «آماده نشده» می‌گیرد.
 */

/*
 * رجیستری درس‌ها از `src/data/micro/registry.js` می‌آید — همان فایلی که سرور
 * (`database/contentStore.js`) هم برای seed و ساخت درسنامهٔ تازه می‌خواند.
 * قبلاً این فهرست ۱۶تایی دو نسخه داشت و روزی که یک درس اضافه می‌شد، یکی عقب می‌ماند.
 *
 * ترتیب کلیدها مهم است: اولین عضو، درسِ پیش‌فرضِ ورود به میکرودرسنامه است
 * (firstPublishedCourse). فیزیولوژی عمداً اول می‌ماند چون محتوای مرجع و کامل است.
 */
import { MICRO_COURSE_REGISTRY as COURSE_REGISTRY } from '../../data/micro/registry.js';

/*
 * ── کتابخانهٔ منتشرشدهٔ پنل ──
 *
 * درسنامه‌ای که مدیر در پنل ویرایش و «انتشار برای کاربران تپش» می‌کند، منبعش سرور
 * است (`GET /api/public/micro/library`) نه رجیستری ثابت. تا وقتی این مسیر خوانده
 * نمی‌شد، ویرایش پنل روی همان نسخه‌ای که کاربر می‌بیند اثری نداشت — چون UI فقط
 * `COURSE_REGISTRY` را می‌خواند. (همان الگوی `/api/public/flashcards/library`.)
 *
 * رجیستری سرجایش می‌ماند: ساختار فهرست، نگاشت subject→course و همهٔ درس‌های
 * منتشرنشده از آن می‌آید. نسخهٔ منتشرشده **جای** نسخهٔ ثابت را می‌گیرد، نه کنارش.
 *
 * کش کوتاه‌مدت است چون این تابع پرتکرار است؛ خطا هم بالا نمی‌دهد تا نبودِ سرور
 * (پیش‌نمایش استاتیک) کل درسنامه را از کار نیندازد.
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
      const response = await fetch('/api/public/micro/library', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`micro-library-http-${response.status}`);
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

/*
 * نسخهٔ منتشرشدهٔ یک درس، اگر پنل آن را منتشر کرده باشد.
 *
 * کلیدِ اتصال **`subjectId`** است نه `id`: شناسهٔ رجیستری محلی `physiology` است ولی
 * رکورد پنل `mcr-physiology`. اگر با `id` تطبیق می‌دادیم هیچ‌وقت جفت نمی‌شد و ویرایش
 * پنل بی‌اثر می‌ماند — دقیقاً همان چیزی که کاربر گزارش کرد.
 *
 * `id` خروجی روی شناسهٔ محلی یکسان می‌شود، چون کلید پیشرفت کاربر
 * (`tapesh:micro:v1:<user>:<courseId>`) و مسیرهای لایه به آن گره خورده‌اند؛ عوض‌شدنش
 * یعنی پیشرفت ذخیره‌شدهٔ کاربران گم شود. پس رکورد پنل فقط «محتوا» می‌دهد، نه هویت.
 */
function publishedCourse(courseId) {
  if (!courseId) return null;
  const match = publishedCourses.find((course) => course.id === courseId)
    ?? publishedCourses.find((course) => course.subjectId === courseId);
  if (!match) return null;

  const local = Object.values(COURSE_REGISTRY).find((course) => course.subjectId === match.subjectId);
  return local ? { ...match, id: local.id } : match;
}

/* درس‌های میکرودرسنامهٔ ثبت‌شده — منبع نگاشت درسِ فهرست به میکرودرسنامه */
export const AVAILABLE_MICRO_COURSES = Object.keys(COURSE_REGISTRY);

/* نگاشت درسِ فهرست (subjectId مثل physiology) → میکرودرسنامهٔ همان درس */
export const courseIdForSubject = (subjectId) =>
  Object.values(COURSE_REGISTRY).find((course) => course.subjectId === subjectId)?.id ?? null;

export const hasCourseForSubject = (subjectId) => Boolean(courseIdForSubject(subjectId));

/* اولین میکرودرسنامهٔ ثبت‌شده — مسیر پیش‌فرض ورود به میکرودرسنامه */
export const firstPublishedCourse = () => Object.values(COURSE_REGISTRY)[0] ?? null;

/* اولین مبحث دارای محتوا — مسیر پیش‌فرض ورود به خواننده */
export const firstPublishedTopicOf = (course) =>
  course.topics.find((topic) => topic.published) ?? course.topics[0] ?? null;

/* صفحه‌های یک واحد به ترتیب order */
export const orderedPagesOf = (unit) => [...unit.pages].sort((a, b) => a.order - b.order);

/* جریان مطالعه: صفحه‌ها و checkpointها در هم تنیده می‌شوند.
   خروجی: [{kind:'page', page}, {kind:'checkpoint', checkpoint}, ...] به ترتیب اجرا. */
export function buildStudyFlow(unit) {
  const flow = [];
  for (const page of orderedPagesOf(unit)) {
    flow.push({ kind: 'page', page });
    const checkpoint = unit.checkpoints?.find((item) => item.afterPage === page.id);
    if (checkpoint) flow.push({ kind: 'checkpoint', checkpoint });
  }
  return flow;
}

export const MicroContentService = {
  availableCourseIds() {
    return AVAILABLE_MICRO_COURSES;
  },

  hasCourse(courseId) {
    return Boolean(COURSE_REGISTRY[courseId]);
  },

  /* دسترسی همگام به درس — برای فهرست مبحث‌ها که بدون تأخیر رندر می‌شود.
     اگر کتابخانهٔ منتشرشده پیش‌تر خوانده شده باشد، همان مقدم است. */
  getCourseSync(courseId) {
    return publishedCourse(courseId) ?? COURSE_REGISTRY[courseId] ?? null;
  },

  courseIdForSubject(subjectId) {
    return courseIdForSubject(subjectId);
  },

  hasCourseForSubject(subjectId) {
    return hasCourseForSubject(subjectId);
  },

  firstPublishedCourse() {
    return firstPublishedCourse();
  },

  /*
   * خوانندهٔ درسنامه همین‌جا تصمیم می‌گیرد: نسخهٔ منتشرشدهٔ پنل، وگرنه رجیستری ثابت.
   * `loadPublishedCourses` خطا پرتاب نمی‌کند، پس افت سرور فقط به نسخهٔ ثابت برمی‌گردد.
   */
  async getCourse(courseId, { signal } = {}) {
    await loadPublishedCourses();

    if (signal?.aborted) throw new DOMException('درخواست لغو شد', 'AbortError');

    const course = publishedCourse(courseId) ?? COURSE_REGISTRY[courseId];
    if (!course) {
      const error = new Error('میکرودرسنامهٔ این درس هنوز منتشر نشده است.');
      error.code = 'course-not-published';
      throw error;
    }
    return course;
  },

  getTopic(course, topicId) {
    return course.topics.find((topic) => topic.id === topicId)
      ?? course.topics.find((topic) => topic.published)
      ?? course.topics[0]
      ?? null;
  },

  getUnit(course, unitId, topic = null) {
    const units = (topic ? [topic] : course.topics).map((item) => item.units ?? []).flat();
    return units.find((unit) => unit.id === unitId)
      ?? course.topics.map((item) => item.units ?? []).flat()[0]
      ?? null;
  },

  getPage(unit, pageId) {
    return unit.pages.find((page) => page.id === pageId) ?? null;
  },

  getCheckpoint(unit, checkpointId) {
    return unit.checkpoints.find((item) => item.id === checkpointId) ?? null;
  },

  /* مفاهیم هر صفحه — مفهوم‌های تعریف‌شده در واحد + فهرست صفحه‌های مرتبط با آن مفهوم */
  conceptPageMap(unit) {
    const map = new Map();
    for (const page of orderedPagesOf(unit)) {
      for (const conceptId of page.concepts ?? []) {
        if (!map.has(conceptId)) map.set(conceptId, []);
        map.get(conceptId).push(page.id);
      }
    }
    return map;
  },

  /* فاصلهٔ checkpoint قابل تنظیم: unit > topic > course */
  checkpointIntervalOf(course, topic, unit) {
    return unit?.checkpointInterval ?? topic?.checkpointInterval ?? course?.checkpointInterval ?? 4;
  },
};

export default MicroContentService;
