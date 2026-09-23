/*
 * سرویس محتوای میکرودرسنامه — قرارداد دسترسی به درس‌ها و مبحث‌ها.
 * مثل ContentService درسنامهٔ جامع، پیاده‌سازی امروز از دادهٔ محلی می‌خواند و
 * با اتصال Backend فقط بدنهٔ getCourse به fetch تبدیل می‌شود؛ امضا و شکل Entity
 * عوض نمی‌شود (قرارداد آینده: GET /api/micro/courses/:courseId).
 *
 * سلسله‌مراتب: درس (subject) → مبحث (topic) → واحد یادگیری → صفحه‌های میکرو.
 * پرچم `published` فقط «آمادگی محتوا» را نشان می‌دهد (مسیر پیش‌فرض ورود به خواننده و
 * انتخاب مبحث پیش‌فرض در getTopic)؛ در رابط کاربری هیچ حالتی را پنهان نمی‌کند —
 * همهٔ مبحث‌ها در فهرست فعال‌اند و مبحث بدون واحد، پیام «آماده نشده» می‌گیرد.
 */

import physiologyCourse from '../../data/micro/physiologyCourse';

const COURSE_REGISTRY = {
  physiology: physiologyCourse,
};

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

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

  /* دسترسی همگام به رجیستری — برای فهرست مبحث‌ها که بدون تأخیر رندر می‌شود */
  getCourseSync(courseId) {
    return COURSE_REGISTRY[courseId] ?? null;
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

  async getCourse(courseId, { signal } = {}) {
    await wait(220);

    if (signal?.aborted) throw new DOMException('درخواست لغو شد', 'AbortError');

    const course = COURSE_REGISTRY[courseId];
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
